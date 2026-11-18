// Wolt venues for the price ingest (see ../wolt.ts for the source and why it
// exists): the venue fetcher, the Wolt run (priced venues) and the photo-only
// venues. Every response is cached under raw/wolt/ and a file we already have
// is never fetched again, so one venue is downloaded at most once per day; the
// ingest prunes the raw dir after 7 days.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChainConfig } from '../chains.ts';
import { storeId } from '../collections.ts';
import type { CanonItem } from '../normalize.ts';
import { israelLocalNow } from '../snapshot.ts';
import { leafCategories, woltItems, type WoltCategory, type WoltItem } from '../wolt.ts';
import { REQUEST_GAP_MS } from './cache.ts';
import type { Selector } from './select.ts';
import { Throttle, errorMessage } from './sources.ts';
import { emptyState, type Registry, type StateStore, type StoreRecord } from './state.ts';

const API = 'https://consumer-api.wolt.com';
// The consumer API answers browsers; a bare client gets the same JSON, but say who we are in the UA comment.
const USER_AGENT = 'Mozilla/5.0 (compatible; hatom-shopping-ingest/0.1)';
/** A runaway pagination guard: the largest category seen has one page. */
const MAX_PAGES = 20;

/** One venue to fetch, from places/wolt.json in the cache dir. */
export interface WoltVenueConfig {
  /** The venue sells only part of the shop (e.g. produce): keep the manual shop listed as well. */
  manualToo?: boolean;
  /**
   * Only its photos are used (by barcode), not its prices: e.g. a Wolt Market
   * dark store, whose big photographed catalogue fills in photos for items the
   * chains sell. Fetched at most once a week.
   */
  photosOnly?: boolean;
  slug: string;
  /** Target city id (cities.ts). */
  cityId: string;
  /** Discovery place id the venue was approved from; places it for the pin filter. */
  placeId?: string;
}

export interface WoltVenue {
  slug: string;
  name: string;
  address: string;
  items: CanonItem[];
  /** Responses fetched from the network this run (the rest came from the cache). */
  fetched: number;
}

interface StaticPage { venue?: { name?: string; address?: string } }
interface Assortment { categories?: WoltCategory[] }
interface CategoryPage { items?: WoltItem[]; metadata?: { next_page_token?: string | null } }

/**
 * A venue's items, from the cache where a response is there, else fetched.
 * `offline`: nothing is fetched; a response that isn't cached is an error.
 */
export async function fetchWoltVenue(
  slug: string,
  rawDir: string,
  day: string,
  throttle: Throttle,
  opts: { offline?: boolean; fetch?: typeof globalThis.fetch } = {},
): Promise<WoltVenue> {
  const { offline = false, fetch = globalThis.fetch } = opts;
  let fetched = 0;
  const get = async <T,>(cacheName: string, path: string): Promise<T> => {
    const file = join(rawDir, `${slug}-${day}-${cacheName}.json`);
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as T;
    if (offline) throw new Error(`${cacheName} is not cached for ${day} (--offline)`);
    const body = await throttle.run(async () => {
      const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Wolt ${res.status} for ${path}`);
      return res.text();
    });
    fetched++;
    writeFileSync(file, body);
    return JSON.parse(body) as T;
  };

  const page = await get<StaticPage>('venue', `/order-xp/web/v1/pages/venue/slug/${slug}/static`);
  const base = `/consumer-api/consumer-assortment/v1/venues/slug/${slug}/assortment`;
  const assortment = await get<Assortment>('assortment', `${base}?language=he`);
  const raw: WoltItem[] = [];
  for (const { slug: cat, path } of leafCategories(assortment.categories ?? [])) {
    let token: string | null = null;
    for (let p = 1; p <= MAX_PAGES; p++) {
      const q = new URLSearchParams({ language: 'he', ...(token ? { page_token: token } : {}) });
      const r: CategoryPage = await get<CategoryPage>(`cat-${cat}-p${p}`, `${base}/categories/slug/${cat}?${q}`);
      raw.push(...(r.items ?? []).map((it) => ({ ...it, category: path })));
      token = r.metadata?.next_page_token ?? null;
      if (!token) break;
    }
  }
  return {
    slug,
    name: page.venue?.name ?? slug,
    address: page.venue?.address ?? '',
    items: woltItems(slug, raw),
    fetched,
  };
}

/** Israel local "YYYY-MM-DDTHH:mm" → the Sunday of its week, "YYYYMMDD". */
export function weekOf(nowLocal: string): string {
  const day = new Date(`${nowLocal.slice(0, 10)}T00:00:00Z`);
  return new Date(day.getTime() - day.getUTCDay() * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');
}

/** What the Wolt run needs from the job. */
export interface WoltRun {
  /** The raw cache dir; responses go under raw/wolt/. */
  rawDir: string;
  state: StateStore;
  select: Selector;
  /** The registry as saved by the last run: a venue that fails to load keeps its name and address. */
  saved: Registry;
  log(msg: string): void;
  warn(msg: string): void;
  maxStores: number | null;
  /** Israel local "YYYY-MM-DDTHH:mm"; a test passes its own. */
  nowLocal?: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * The priced Wolt venues (places/wolt.json, selected by ingest/select.ts). A
 * venue that fails to load keeps its previous items, like a chain store whose
 * PriceFull is missing.
 */
export async function ingestWolt(chain: ChainConfig, run: WoltRun): Promise<StoreRecord[]> {
  const { state, log, warn } = run;
  const sel = await run.select.selectWolt();
  for (const d of sel.dropped) log(`  ${d.venue.slug}: ${d.why} — left out`);
  const venues = run.maxStores === null ? sel.kept : sel.kept.slice(0, run.maxStores);
  log(`${chain.slug}: ${venues.length} venues in target cities (places/wolt.json)`);
  const rawDir = join(run.rawDir, chain.slug);
  mkdirSync(rawDir, { recursive: true });
  const nowLocal = run.nowLocal ?? israelLocalNow(); // "YYYY-MM-DDTHH:mm"
  const day = nowLocal.slice(0, 10).replace(/-/g, '');
  const throttle = new Throttle(REQUEST_GAP_MS);
  const out: StoreRecord[] = [];
  for (const { venue: v, at } of venues) {
    const rec: StoreRecord = {
      chainId: chain.chainId, storeId: v.slug, subChainId: '', name: v.slug, address: '', city: v.cityId, kind: 'physical',
      chainSlug: chain.slug, chainName: chain.name, cityId: v.cityId, at,
    };
    const prev = state.load(rec);
    const hadPrices = prev?.priceFile ?? null;
    const next = prev ?? emptyState(chain.chainId, v.slug);
    try {
      const venue = await fetchWoltVenue(v.slug, rawDir, day, throttle, { fetch: run.fetch });
      rec.name = venue.name;
      rec.address = venue.address;
      if (!venue.items.length) throw new Error('no items');
      next.items = venue.items;
      // Same day = same cached responses, so the stamp only moves when the data can have.
      next.priceFile = venue.fetched || !hadPrices ? `wolt-${v.slug}-${nowLocal.replace(/[-T:]/g, '')}` : hadPrices;
      const withBarcode = venue.items.filter((i) => i.barcode).length;
      log(`  ${v.slug.padEnd(30)} ${venue.name} — ${venue.items.length} items (${withBarcode} with barcode), ${venue.fetched} requests`);
    } catch (e) {
      warn(`${chain.slug} venue ${v.slug}: ${errorMessage(e)} — keeping previous items`);
      const old = run.saved[storeId(rec)];
      if (old) Object.assign(rec, { name: old.name, address: old.address });
    }
    state.save(next);
    out.push(rec);
  }
  return out;
}

/**
 * barcode → photo link from the photo-only Wolt venues (places/wolt.json
 * `photosOnly`). Their responses are cached under the week's Sunday, so a
 * venue is downloaded at most once a week; --offline only reads that cache
 * and makes no request.
 */
export async function woltPhotos(
  venues: WoltVenueConfig[],
  run: { rawDir: string; offline: boolean; log(msg: string): void; warn(msg: string): void; nowLocal?: string; fetch?: typeof globalThis.fetch },
): Promise<Map<string, string>> {
  const { log, warn, offline } = run;
  const out = new Map<string, string>();
  const photoVenues = venues.filter((v) => v.photosOnly);
  if (!photoVenues.length) return out;
  const rawDir = join(run.rawDir, 'wolt');
  mkdirSync(rawDir, { recursive: true });
  const week = weekOf(run.nowLocal ?? israelLocalNow());
  const throttle = new Throttle(REQUEST_GAP_MS);
  for (const v of photoVenues) {
    if (offline && !existsSync(join(rawDir, `${v.slug}-${week}-assortment.json`))) {
      log(`  ${v.slug}: photos not cached for week ${week} — skipped (--offline)`);
      continue;
    }
    try {
      const venue = await fetchWoltVenue(v.slug, rawDir, week, throttle, { offline, fetch: run.fetch });
      let n = 0;
      for (const it of venue.items) {
        if (!it.barcode || !it.img || out.has(it.key)) continue;
        out.set(it.key, it.img);
        n++;
      }
      log(`  ${v.slug.padEnd(30)} ${venue.name} — photos for ${n} barcodes (${venue.fetched} requests)`);
    } catch (e) {
      warn(`photo venue ${v.slug}: ${errorMessage(e)}`);
    }
  }
  return out;
}
