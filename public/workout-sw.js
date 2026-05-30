/* Service worker for the /workout PWA.
 *
 * Three jobs:
 *  1. Cache the workout shell + read APIs so the page loads with no
 *     network ("Add to Home Screen" → tap → see your last templates).
 *  2. On a failed mutating workout API call (offline, 5xx, timeout),
 *     enqueue the request to IndexedDB and return a synthetic 202 so
 *     the UI thinks it worked. The page-level offline banner is the
 *     only signal the user sees that anything was deferred.
 *  3. Replay the queue when the page tells us we're back online (via
 *     postMessage), draining FIFO and stopping on the first failure.
 *
 * Non-workout URLs are passed straight through — this SW is registered
 * sitewide (Next can't easily set Service-Worker-Allowed for
 * sub-path scoping) but only acts on /workout/* + /api/workout/*.
 */

const VERSION = 'v1';
const CACHE = `hatom-workout-${VERSION}`;
const OUTBOX_DB = 'hatom-workout-outbox';
const OUTBOX_STORE = 'requests';

// We don't pre-cache the workout shell at install time on purpose. The
// SW runs without the user's auth cookie scoped to the page navigation,
// so a pre-cache would hand back 307 redirects to /login. Instead, the
// runtime fetch handler caches every successful GET as it happens — the
// first online visit to each workout page primes the offline copy.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;  // pass-through for blob/CDN/google etc.

  const isWorkoutApi = url.pathname.startsWith('/api/workout/');
  const isWorkoutPage = url.pathname === '/workout' || url.pathname.startsWith('/workout/');
  const isNextChunk = url.pathname.startsWith('/_next/');

  if (isWorkoutApi && request.method !== 'GET') {
    event.respondWith(networkOrQueue(request));
    return;
  }
  if (isWorkoutApi || isWorkoutPage) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isNextChunk) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // Everything else (other features, auth callbacks, etc.) — passthrough.
});

self.addEventListener('message', (event) => {
  if (event.data === 'flush-outbox') {
    event.waitUntil(flushOutbox().then((flushed) => {
      if (flushed > 0) broadcast({ type: 'outbox-flushed', count: flushed });
    }));
  }
});

// ---- caching strategies -------------------------------------------------

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    // Only cache same-URL GET responses. If the user is signed out and
    // /workout 307s to /login, fetch follows the redirect and res.url
    // points at /login — we'd be caching the login page under the
    // /workout key, which would render the wrong thing while offline.
    if (
      res.ok &&
      request.method === 'GET' &&
      new URL(res.url).pathname === new URL(request.url).pathname
    ) {
      const cache = await caches.open(CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit) return hit;
    return new Response('Offline and not cached', { status: 503 });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ---- offline write queue ------------------------------------------------

async function networkOrQueue(request) {
  try {
    const res = await fetch(request.clone());
    // 4xx is the caller's fault (validation, auth) — surface it, don't queue.
    // 5xx and 0 (network) are transient — queue.
    if (res.ok || (res.status >= 400 && res.status < 500)) return res;
    throw new Error('upstream-' + res.status);
  } catch {
    try {
      const body = await request.clone().text();
      const headers = {};
      for (const [k, v] of request.headers.entries()) headers[k] = v;
      await queueRequest({
        url: request.url,
        method: request.method,
        headers,
        body,
        queuedAt: Date.now(),
      });
      broadcast({ type: 'outbox-queued' });
      return new Response(
        JSON.stringify({ queued: true, queuedAt: new Date().toISOString() }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      );
    } catch {
      return new Response(JSON.stringify({ error: 'offline-and-queue-failed' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

function openOutbox() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueRequest(record) {
  const db = await openOutbox();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    const req = tx.objectStore(OUTBOX_STORE).add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listOutbox() {
  const db = await openOutbox();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readonly');
    const req = tx.objectStore(OUTBOX_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteOutboxEntry(id) {
  const db = await openOutbox();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    const req = tx.objectStore(OUTBOX_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function flushOutbox() {
  const records = await listOutbox();
  let drained = 0;
  for (const r of records) {
    try {
      const res = await fetch(r.url, {
        method: r.method,
        headers: r.headers,
        body: r.body,
        credentials: 'include',
      });
      if (res.ok) {
        await deleteOutboxEntry(r.id);
        drained += 1;
      } else if (res.status >= 400 && res.status < 500) {
        // The server rejected it (auth, validation). Drop it — replaying
        // won't help. Surface via broadcast so the page can warn the user.
        await deleteOutboxEntry(r.id);
        broadcast({ type: 'outbox-dropped', status: res.status, url: r.url });
      } else {
        // 5xx — still flaky, leave the rest in queue for the next try.
        break;
      }
    } catch {
      // Still offline; abort drain.
      break;
    }
  }
  return drained;
}

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}
