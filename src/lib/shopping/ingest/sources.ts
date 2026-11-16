// Fetchers for each access method. Every request goes through `Throttle`
// (one request per host at a time, a minimum gap between them), and the
// caller never downloads a file whose name is already in the raw cache.

import { parseFileName, type FileNameInfo, type FileType } from '../normalize.ts';
import type { ChainConfig } from '../chains.ts';

export interface RemoteFile {
  name: string;
  info: FileNameInfo;
  /** Opaque download handle (a URL, or a name the client knows how to fetch). */
  ref: string;
}

export interface SourceClient {
  /** The newest Stores file. */
  latestStores(): Promise<RemoteFile | null>;
  /** The newest file of `type` for each of `storeIds` (normalized ids). */
  latestFor(type: Extract<FileType, 'PriceFull' | 'PromoFull'>, storeIds: string[]): Promise<Map<string, RemoteFile>>;
  download(file: RemoteFile): Promise<Uint8Array>;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const UA = 'hatom-shopping-ingest/0.1 (personal price comparison; throttled)';

export class Throttle {
  private last = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly gapMs: number;
  constructor(gapMs: number) {
    this.gapMs = gapMs;
  }
  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(async () => {
      const wait = this.last + this.gapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        this.last = Date.now();
      }
    });
    this.chain = next.catch(() => undefined);
    return next;
  }
}

async function withRetry<T>(what: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let err: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error(`${what} failed after ${attempts} attempts: ${errorMessage(err)}`);
}

async function okBytes(res: Response, what: string): Promise<Uint8Array> {
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function newestByStore(files: RemoteFile[], type: FileType, storeIds: string[]): Map<string, RemoteFile> {
  const want = new Set(storeIds);
  const out = new Map<string, RemoteFile>();
  for (const f of files) {
    if (f.info.type !== type || !f.info.storeId || !want.has(f.info.storeId)) continue;
    const cur = out.get(f.info.storeId);
    if (!cur || f.info.stamp > cur.info.stamp) out.set(f.info.storeId, f);
  }
  return out;
}

/** The newest Stores file in a listing. */
function newestStores(files: RemoteFile[]): RemoteFile | null {
  return files.filter((f) => f.info.type === 'Stores').sort((a, b) => b.info.stamp.localeCompare(a.info.stamp))[0] ?? null;
}

function toRemote(name: string, ref: string): RemoteFile | null {
  const info = parseFileName(name);
  return info ? { name, info, ref } : null;
}

// ── Cerberus (url.publishedprices.co.il) ─────────────────────────────────

const CERBERUS = 'https://url.publishedprices.co.il';

export function cerberusClient(username: string, throttle: Throttle): SourceClient {
  const cookies = new Map<string, string>();
  let listing: RemoteFile[] | null = null;

  const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  const keepCookies = (res: Response) => {
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      if (i > 0) cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
  };
  const req = (path: string, init: RequestInit = {}) =>
    throttle.run(async () => {
      const res = await fetch(CERBERUS + path, {
        ...init,
        redirect: 'manual',
        headers: { 'User-Agent': UA, Cookie: cookieHeader(), ...(init.headers ?? {}) },
      });
      keepCookies(res);
      return res;
    });
  const csrf = async (path: string) => {
    const html = await (await req(path)).text();
    const m = /name="csrftoken"\s+content="([^"]+)"/.exec(html) ?? /csrftoken" content="([^"]+)"/.exec(html);
    if (!m) throw new Error(`cerberus ${username}: no csrftoken on ${path}`);
    return m[1];
  };

  async function login() {
    const token = await csrf('/login');
    const body = new URLSearchParams({ r: '', username, password: '', Submit: 'Sign in', csrftoken: token });
    const res = await req('/login/user', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const loc = res.headers.get('location') ?? '';
    if (res.status !== 302 || !loc.includes('/file')) throw new Error(`cerberus ${username}: login rejected (${res.status} ${loc})`);
  }

  async function list(): Promise<RemoteFile[]> {
    if (listing) return listing;
    await withRetry(`cerberus ${username} login`, login);
    const token = await csrf('/file');
    const body = new URLSearchParams({
      sEcho: '1', iDisplayStart: '0', iDisplayLength: '100000', sSearch: '', cd: '/', csrftoken: token,
    });
    const res = await req('/file/json/dir', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) throw new Error(`cerberus ${username}: dir listing HTTP ${res.status}`);
    const json = (await res.json()) as { aaData?: { name: string }[] };
    listing = (json.aaData ?? []).map((r) => toRemote(r.name, r.name)).filter((f): f is RemoteFile => f !== null);
    return listing;
  }

  return {
    async latestStores() {
      return newestStores(await list());
    },
    async latestFor(type, storeIds) {
      return newestByStore(await list(), type, storeIds);
    },
    download(file) {
      return withRetry(`cerberus download ${file.name}`, async () =>
        okBytes(await req(`/file/d/${encodeURIComponent(file.ref)}`), file.name),
      );
    },
  };
}

// ── Shufersal (prices.shufersal.co.il) ───────────────────────────────────
// The listing links are signed Azure blob URLs valid for ~1h, so list and
// download in the same run (the CLI does).

const SHUFERSAL = 'https://prices.shufersal.co.il';
const SHUFERSAL_CAT: Record<'Stores' | 'PriceFull' | 'PromoFull', number> = { PriceFull: 2, PromoFull: 4, Stores: 5 };

function parseShufersalListing(html: string): RemoteFile[] {
  const out: RemoteFile[] = [];
  for (const m of html.matchAll(/href="(https:\/\/[^"]+\.blob\.core\.windows\.net\/[^"]+)"/g)) {
    const url = m[1].replace(/&amp;/g, '&');
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    const f = toRemote(name, url);
    if (f) out.push(f);
  }
  return out;
}

export function shufersalClient(throttle: Throttle): SourceClient {
  const get = (url: string) =>
    throttle.run(() => fetch(url, { headers: { 'User-Agent': UA } }));
  const listing = async (cat: number, storeId = 0) => {
    const html = await withRetry(`shufersal listing cat ${cat} store ${storeId}`, async () => {
      const res = await get(`${SHUFERSAL}/FileObject/UpdateCategory?catID=${cat}&storeId=${storeId}&page=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    });
    return parseShufersalListing(html);
  };
  return {
    async latestStores() {
      return newestStores(await listing(SHUFERSAL_CAT.Stores));
    },
    async latestFor(type, storeIds) {
      const out = new Map<string, RemoteFile>();
      for (const id of storeIds) {
        const found = newestByStore(await listing(SHUFERSAL_CAT[type], Number(id)), type, [id]).get(id);
        if (found) out.set(id, found);
      }
      return out;
    },
    download(file) {
      return withRetry(`shufersal download ${file.name}`, async () => okBytes(await get(file.ref), file.name));
    },
  };
}

export function clientFor(chain: ChainConfig, throttle: Throttle): SourceClient {
  switch (chain.source.kind) {
    case 'cerberus':
      return cerberusClient(chain.source.username, throttle);
    case 'shufersal':
      return shufersalClient(throttle);
    case 'wolt':
    case 'manual':
      throw new Error(`${chain.source.kind} has no price files — the ingest builds it separately`);
  }
}
