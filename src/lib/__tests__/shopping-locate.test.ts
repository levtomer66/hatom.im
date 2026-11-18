import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pin } from '../shopping/places.ts';
import { NominatimError } from '../shopping/ingest/geo.ts';
import { MISS_TTL_MS, geocoder, locator, type GeocodeCache } from '../shopping/ingest/locate.ts';
import { makePicks, type PicksData, type ReviewRow } from '../shopping/ingest/picks.ts';
import { selector, type SelectableStore } from '../shopping/ingest/select.ts';
import { walkRouter } from '../shopping/ingest/walk.ts';

const NOW = Date.parse('2026-11-18T10:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function geo(cache: GeocodeCache, opts: { offline?: boolean; answers?: Record<string, { lat: number; lng: number } | null | Error> } = {}) {
  const asked: string[] = [];
  let saves = 0;
  const geocode = geocoder({
    cache,
    save: () => void saves++,
    offline: opts.offline ?? false,
    now: () => NOW,
    search: async (q) => {
      asked.push(q);
      const a = opts.answers?.[q] ?? null;
      if (a instanceof Error) throw a;
      return a;
    },
  });
  return { geocode, asked, saves: () => saves };
}

test('geocoder: a hit is kept forever; a miss is asked again only after 30 days', async () => {
  assert.equal(MISS_TTL_MS, 30 * 86_400_000);
  const cache: GeocodeCache = {
    hit: { p: { lat: 32.08, lng: 34.78 }, at: daysAgo(900) },
    'fresh miss': { p: null, at: daysAgo(29) },
    'old miss': { p: null, at: daysAgo(31) },
  };
  const g = geo(cache, { answers: { 'old miss': { lat: 31.25, lng: 34.79 }, 'new': null } });
  assert.deepEqual(await g.geocode('hit'), { lat: 32.08, lng: 34.78 });
  assert.equal(await g.geocode('fresh miss'), null);
  assert.deepEqual(g.asked, []); // a day-old miss used to be asked again on every run
  assert.deepEqual(await g.geocode('old miss'), { lat: 31.25, lng: 34.79 });
  assert.equal(await g.geocode('new'), null);
  assert.deepEqual(g.asked, ['old miss', 'new']);
  assert.deepEqual(cache['old miss'], { p: { lat: 31.25, lng: 34.79 }, at: new Date(NOW).toISOString() });
  assert.deepEqual(cache['new'], { p: null, at: new Date(NOW).toISOString() });
  assert.equal(g.saves(), 2);
});

test('geocoder: a refusal from Nominatim places nothing this run and is not cached; other failures are raised', async () => {
  const cache: GeocodeCache = {};
  const g = geo(cache, { answers: { busy: new NominatimError(429), down: new TypeError('fetch failed') } });
  assert.equal(await g.geocode('busy'), null);
  assert.deepEqual(cache, {});
  await assert.rejects(g.geocode('down'), /fetch failed/);
});

test('geocoder: offline answers from the cache only — a miss of any age stands, an unknown address is "uncached"', async () => {
  const cache: GeocodeCache = { hit: { p: { lat: 32.08, lng: 34.78 }, at: daysAgo(1) }, 'old miss': { p: null, at: daysAgo(400) } };
  const g = geo(cache, { offline: true });
  assert.deepEqual(await g.geocode('hit'), { lat: 32.08, lng: 34.78 });
  assert.equal(await g.geocode('old miss'), null);
  assert.equal(await g.geocode('never asked'), 'uncached');
  assert.deepEqual(g.asked, []);
  assert.equal(g.saves(), 0);
});

// ── the locator over real cache files, offline ───────────────────────────

const home: Pin = { id: 'home', label: 'בית', lat: 32.08, lng: 34.78, city: 'tel-aviv', walkMinutes: 12 };
const area: Pin = { id: 'area', label: 'שכונה', lat: 31.25, lng: 34.79, city: 'beer-sheva', radiusM: 800 };
const row = (over: Partial<ReviewRow> & { id: string }): ReviewRow => ({
  name: over.id, names: [over.id], lat: 32.081, lng: 34.781, address: 'ביאליק 1', categories: [], sources: ['google'],
  refs: [over.id], distanceM: 100, status: 'none', retailer: null, official: null, decision: 'pending', ...over,
});
const picksOf = (over: Partial<PicksData> = {}) =>
  makePicks({ pins: [home, area], rings: new Map(), reviews: [], decisions: {}, handMatches: {}, woltVenues: [], ...over });
const st = (id: string, address: string, cityId = 'tel-aviv'): SelectableStore => ({
  chainId: 'c', storeId: id, chainSlug: 'yohananof', chainName: 'יוחננוף', name: `סניף ${id}`, address, kind: 'physical', cityId,
});

const walkKey = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(5)).join(',');

function places() {
  const dir = mkdtempSync(join(tmpdir(), 'hatom-locate-'));
  const near = { lat: 32.083, lng: 34.781 };
  const far = { lat: 32.086, lng: 34.785 };
  const unrouted = { lat: 32.079, lng: 34.779 };
  writeFileSync(join(dir, 'geocode.json'), JSON.stringify({
    'הרצל 1 תל אביב': { p: near, at: daysAgo(40) },
    'הרצל 99 תל אביב': { p: far, at: daysAgo(40) },
    'אלנבי 5 תל אביב': { p: unrouted, at: daysAgo(40) },
    'לא קיים 3 תל אביב': { p: null, at: daysAgo(40) },
    'לא קיים תל אביב': { p: null, at: daysAgo(40) },
    'סניף 5 תל אביב': { p: null, at: daysAgo(40) },
  }, null, 1));
  writeFileSync(join(dir, 'walk.json'), JSON.stringify({
    [walkKey(home, near)]: { s: 420, m: 500 },
    [walkKey(home, far)]: { s: 900, m: 1100 },
  }));
  return { dir, near, far, unrouted };
}

/** Any network request fails the test's count. */
function noNetwork() {
  let calls = 0;
  const fetch: typeof globalThis.fetch = async () => {
    calls++;
    throw new Error('network request in an offline run');
  };
  return { fetch, calls: () => calls };
}

test('locator, offline: stores are placed and held to the walk from the caches, with no network request', async () => {
  const { dir, near, far, unrouted } = places();
  const before = [readFileSync(join(dir, 'geocode.json'), 'utf8'), readFileSync(join(dir, 'walk.json'), 'utf8')];
  const net = noNetwork();
  const loc = locator(dir, picksOf(), { offline: true, fetch: net.fetch });

  assert.deepEqual(await loc.pointOf(st('1', 'הרצל 1')), near);
  assert.equal(await loc.near('tel-aviv', near), true); // 7 minutes
  assert.equal(await loc.near('tel-aviv', far), false); // 15 minutes
  assert.equal(await loc.near('tel-aviv', unrouted), 'uncached');
  assert.equal(await loc.near('tel-aviv', { lat: 32.3, lng: 34.9 }), false); // too far to be within the walk: never routed
  assert.equal(await loc.pointOf(st('5', 'לא קיים 3')), null); // every lookup is a cached miss
  assert.equal(await loc.pointOf(st('6', 'ויצמן 12')), 'uncached');
  assert.equal(await loc.near('beer-sheva', { lat: 31.251, lng: 34.791 }), true); // an area pin: no router
  assert.equal(await loc.near('holon', near), false); // no pin there

  assert.equal(net.calls(), 0);
  assert.deepEqual([readFileSync(join(dir, 'geocode.json'), 'utf8'), readFileSync(join(dir, 'walk.json'), 'utf8')], before);
});

test('locator, offline: a store whose lookup is not cached keeps its saved verdict', async () => {
  const { dir, near, unrouted } = places();
  const net = noNetwork();
  const picks = picksOf({
    reviews: [{ pin: home, rows: [row({ id: 'G:yo', official: { chainSlug: 'yohananof', storeId: '7', name: '', address: '', cityId: 'tel-aviv' }, lat: 32.2, lng: 34.9 })] }],
    decisions: { 'G:yo': 'include' },
  });
  const sel = await selector(picks, locator(dir, picks, { offline: true, fetch: net.fetch })).selectOfficial([
    st('1', 'הרצל 1'), st('2', 'הרצל 99'), st('3', 'אלנבי 5'), st('6', 'ויצמן 12'), st('7', 'דיזנגוף 50'), st('5', 'לא קיים 3'),
  ]);
  assert.deepEqual(sel.kept.map((k) => [k.store.storeId, k.reason, k.store.at ?? null]), [
    ['1', 'near-pin', near],
    ['3', 'uncached', unrouted], // placed, but its walk was never routed
    ['6', 'uncached', null], // its address was never looked up
    ['7', 'included', { lat: 32.2, lng: 34.9 }], // the review's point: no lookup at all
  ]);
  assert.deepEqual(sel.dropped.map((d) => [d.store.storeId, d.reason]), [['2', 'outside'], ['5', 'unplaced']]);
  assert.equal(net.calls(), 0);
});

test('locator, online: an unknown address is looked up once and cached in the file\'s format', async () => {
  const { dir } = places();
  const urls: string[] = [];
  const fetch: typeof globalThis.fetch = async (url) => {
    urls.push(String(url));
    return Response.json(new URL(String(url)).searchParams.get('q') === 'ויצמן 12 תל אביב' ? [{ lat: '32.0851', lon: '34.7822' }] : []);
  };
  const loc = locator(dir, picksOf(), { offline: false, fetch, sleep: async () => {} });
  assert.deepEqual(await loc.pointOf(st('6', 'ויצמן 12')), { lat: 32.0851, lng: 34.7822 });
  assert.deepEqual(await loc.pointOf(st('6', 'ויצמן 12')), { lat: 32.0851, lng: 34.7822 }); // from the cache now
  assert.equal(await loc.pointOf(st('5', 'לא קיים 3')), null); // its two 40-day-old misses are asked again
  assert.deepEqual(urls.map((u) => new URL(u).searchParams.get('q')), ['ויצמן 12 תל אביב', 'לא קיים 3 תל אביב', 'לא קיים תל אביב']);
  assert.match(urls[0], /^https:\/\/nominatim\.openstreetmap\.org\/search\?q=/);
  const text = readFileSync(join(dir, 'geocode.json'), 'utf8');
  const saved = JSON.parse(text) as GeocodeCache;
  assert.deepEqual(saved['ויצמן 12 תל אביב'].p, { lat: 32.0851, lng: 34.7822 });
  assert.equal(text, JSON.stringify(saved, null, 1)); // one-space indent, as before
});

test('walkRouter, offline: a routed pair answers from the cache, an unrouted one is "uncached", nothing is fetched', async () => {
  const { dir, near, unrouted } = places();
  const net = noNetwork();
  const walk = walkRouter(dir, { offline: true, fetch: net.fetch });
  assert.equal(await walk(home, near), 420);
  assert.equal(await walk(home, unrouted), 'uncached');
  assert.equal(net.calls(), 0);
});
