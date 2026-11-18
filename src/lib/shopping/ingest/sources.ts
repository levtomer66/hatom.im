// Fetchers for each access method. Every request goes through `Throttle`
// (one request per host at a time, a minimum gap between them), and the
// caller never downloads a file whose name is already in the raw cache.

import { parseFileName, type FileNameInfo, type FileType } from '../normalize.ts';
import type { ChainConfig } from '../chains.ts';
import { sleep } from './cache.ts';

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
      if (wait > 0) await sleep(wait);
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
      if (i < attempts - 1) await sleep(2000 * (i + 1));
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

/** Direct Azure Blob file links in a listing page (Shufersal, Hazi Hinam). */
function blobLinks(html: string): RemoteFile[] {
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
    return blobLinks(html);
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

/** A client over one full listing (fetched once per run). */
function listingClient(list: () => Promise<RemoteFile[]>, download: (f: RemoteFile) => Promise<Uint8Array>): SourceClient {
  let cached: Promise<RemoteFile[]> | null = null;
  const files = () => (cached ??= list());
  return {
    async latestStores() {
      return newestStores(await files());
    },
    async latestFor(type, storeIds) {
      return newestByStore(await files(), type, storeIds);
    },
    download: (f) => withRetry(`download ${f.name}`, () => download(f)),
  };
}

const getText = async (throttle: Throttle, url: string, init: RequestInit = {}) =>
  withRetry(`GET ${url}`, () =>
    throttle.run(async () => {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    }),
  );
const getBytes = (throttle: Throttle, url: string) =>
  throttle.run(async () => okBytes(await fetch(url, { headers: { 'User-Agent': UA } }), url));

// ── Bina projects (<host>.binaprojects.com) ──────────────────────────────
// POST MainIO_Hok.aspx with a day (dd/mm/yyyy) lists that day's files as
// JSON; Download.aspx?FileNm= answers [{SPath}], the real file URL. Early in
// the morning today's listing can be empty, so yesterday's is read too.

export function binaClient(host: string, throttle: Throttle): SourceClient {
  const base = `https://${host}.binaprojects.com`;
  const day = (offset: number) => {
    const d = new Date(Date.now() - offset * 86_400_000);
    const [y, m, dd] = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).split('-');
    return `${dd}/${m}/${y}`;
  };
  return listingClient(
    async () => {
      const out: RemoteFile[] = [];
      for (const offset of [0, 1]) {
        const body = new URLSearchParams({ WStore: '', WDate: day(offset), WFileType: '0' });
        const json = await getText(throttle, `${base}/MainIO_Hok.aspx`, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const rows = (json.trim() ? JSON.parse(json) : []) as { FileNm: string }[];
        out.push(...rows.map((r) => toRemote(r.FileNm, r.FileNm)).filter((f): f is RemoteFile => f !== null));
      }
      return out;
    },
    async (f) => {
      const [hit] = JSON.parse(await getText(throttle, `${base}/Download.aspx?FileNm=${encodeURIComponent(f.ref)}`)) as { SPath?: string }[];
      if (!hit?.SPath) throw new Error(`bina ${host}: no download path for ${f.name}`);
      return getBytes(throttle, hit.SPath.replace(/\\/g, '/'));
    },
  );
}

// ── Laibcatalog (laibcatalog.co.il web API) ──────────────────────────────

const LAIB = 'https://laibcatalog.co.il/webapi';

export function laibcatalogClient(chainId: string, throttle: Throttle): SourceClient {
  return listingClient(
    async () => {
      const rows = JSON.parse(await getText(throttle, `${LAIB}/api/getfiles?edi=${chainId}`)) as { fileName: string }[];
      return rows.map((r) => toRemote(r.fileName, r.fileName)).filter((f): f is RemoteFile => f !== null);
    },
    (f) => getBytes(throttle, `${LAIB}/${chainId}/${encodeURIComponent(f.ref)}`),
  );
}

// ── PublishPrice (prices.<site>.co.il) ───────────────────────────────────
// The page embeds today's listing as `const files = [...]` and its folder as
// `const path = 'YYYYMMDD'`; a file is served at /<path>/<name>.

export function publishPriceClient(site: string, throttle: Throttle): SourceClient {
  const base = `https://prices.${site}.co.il`;
  return listingClient(
    async () => {
      const html = await getText(throttle, `${base}/`);
      const files = /const files = (\[[\s\S]*?\]);/.exec(html)?.[1];
      const path = /const path = '(\d{8})'/.exec(html)?.[1];
      if (!files || !path) throw new Error(`publishprice ${site}: no file listing on the page`);
      return (JSON.parse(files) as { name: string }[])
        .map((r) => toRemote(r.name, `${path}/${r.name}`))
        .filter((f): f is RemoteFile => f !== null);
    },
    (f) => getBytes(throttle, `${base}/${f.ref.split('/').map(encodeURIComponent).join('/')}`),
  );
}

// ── Super-Pharm (prices.super-pharm.co.il) ───────────────────────────────
// An MVC grid: `?Category-equals=<type>&Date-equals=<dd/mm/yyyy>&page=N`, 20
// rows a page with the total in `data-total-rows`; links are
// `/Download/<name>?bucketName=…` and answer the gz file itself. Today's and
// yesterday's listings are read (early in the day today's can be empty).

const SUPER_PHARM = 'https://prices.super-pharm.co.il';

export function superPharmClient(throttle: Throttle): SourceClient {
  const day = (offset: number) => {
    const [y, m, d] = new Date(Date.now() - offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).split('-');
    return `${d}/${m}/${y}`;
  };
  const listing = async (category: string) => {
    const out: RemoteFile[] = [];
    for (const offset of [0, 1]) {
      for (let page = 1, pages = 1; page <= pages && page <= 100; page++) {
        const q = new URLSearchParams({ 'Category-equals': category, 'Date-equals': day(offset), page: String(page) });
        const html = await getText(throttle, `${SUPER_PHARM}/?${q}`);
        const total = Number(/data-total-rows="(\d+)"/.exec(html)?.[1] ?? 0);
        pages = Math.ceil(total / 20);
        for (const m of html.matchAll(/href="(\/Download\/([^"?]+)\?[^"]*)"/g)) {
          const f = toRemote(decodeURIComponent(m[2]), m[1].replace(/&amp;/g, '&'));
          if (f) out.push(f);
        }
      }
    }
    return out;
  };
  const cache = new Map<string, Promise<RemoteFile[]>>();
  const files = (c: string) => {
    if (!cache.has(c)) cache.set(c, listing(c));
    return cache.get(c)!;
  };
  return {
    async latestStores() {
      return newestStores(await files('Stores'));
    },
    async latestFor(type, storeIds) {
      return newestByStore(await files(type), type, storeIds);
    },
    download: (f) => withRetry(`download ${f.name}`, () => getBytes(throttle, `${SUPER_PHARM}${f.ref}`)),
  };
}

// ── Hazi Hinam (shop.hazi-hinam.co.il/Prices) ─────────────────────────────
// A server-rendered table, 50 rows a page: ?p=<page>&t=<type>&d=<YYYY-MM-DD>
// (t: 1 prices — PriceFull and the hourly deltas together, 2 promos, 3 stores),
// each row linking straight to the file on Azure Blob. The Stores file is
// named StoresFull…. Full files land at ~00:00–00:50; until then a store's
// newest is yesterday's, so yesterday is read only for what today lacks.

const HAZI_HINAM = 'https://shop.hazi-hinam.co.il/Prices';
const HAZI_HINAM_TYPE = { PriceFull: 1, PromoFull: 2, Stores: 3 } as const;

export const haziHinamListingUrl = (type: keyof typeof HAZI_HINAM_TYPE, day: string, page: number) =>
  `${HAZI_HINAM}?${new URLSearchParams({ p: String(page), t: String(HAZI_HINAM_TYPE[type]), d: day })}`;

export function parseHaziHinamListing(html: string): { files: RemoteFile[]; lastPage: number } {
  const pages = [...html.matchAll(/href="\?p=(\d+)/g)].map((m) => Number(m[1]));
  return { files: blobLinks(html), lastPage: Math.max(1, ...pages) };
}

export function haziHinamClient(throttle: Throttle): SourceClient {
  const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const listing = async (type: keyof typeof HAZI_HINAM_TYPE, offset: number) => {
    const out: RemoteFile[] = [];
    for (let page = 1, last = 1; page <= last && page <= 50; page++) {
      const { files, lastPage } = parseHaziHinamListing(await getText(throttle, haziHinamListingUrl(type, day(offset), page)));
      if (!files.length) break;
      out.push(...files);
      last = lastPage;
    }
    return out;
  };
  const cache = new Map<string, Promise<RemoteFile[]>>();
  const files = (type: keyof typeof HAZI_HINAM_TYPE, offset: number) => {
    const k = `${type}/${offset}`;
    if (!cache.has(k)) cache.set(k, listing(type, offset));
    return cache.get(k)!;
  };
  return {
    async latestStores() {
      return newestStores(await files('Stores', 0)) ?? newestStores(await files('Stores', 1));
    },
    async latestFor(type, storeIds) {
      const out = newestByStore(await files(type, 0), type, storeIds);
      const missing = storeIds.filter((id) => !out.has(id));
      if (missing.length) for (const [id, f] of newestByStore(await files(type, 1), type, missing)) out.set(id, f);
      return out;
    },
    download: (f) => withRetry(`download ${f.name}`, () => getBytes(throttle, f.ref)),
  };
}

export function clientFor(chain: ChainConfig, throttle: Throttle): SourceClient {
  switch (chain.source.kind) {
    case 'cerberus':
      return cerberusClient(chain.source.username, throttle);
    case 'shufersal':
      return shufersalClient(throttle);
    case 'bina':
      return binaClient(chain.source.host, throttle);
    case 'laibcatalog':
      return laibcatalogClient(chain.chainId, throttle);
    case 'publishprice':
      return publishPriceClient(chain.source.site, throttle);
    case 'superpharm':
      return superPharmClient(throttle);
    case 'hazihinam':
      return haziHinamClient(throttle);
    case 'wolt':
    case 'manual':
      throw new Error(`${chain.source.kind} has no price files — the ingest builds it separately`);
  }
}
