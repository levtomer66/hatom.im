// Keeps the price ingest to the stores near the pins (places/pins.json):
// official store files carry addresses but no coordinates, so each store is
// placed by (1) the discovery review's match of a mapped shop to that store,
// else (2) a Nominatim lookup of its address, cached forever per query in
// places/geocode.json (a miss is retried after a day: Nominatim answers []
// while it throttles a client). Online stores are not location-bound and always
// pass. A pin with `walkMinutes` keeps only stores within that walk (a routed
// walking time, ingest/walk.ts); there a store that can't be placed is dropped,
// since it can't be shown to meet the limit. Without walkMinutes, an unplaced
// store is kept and logged.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CITIES } from '../cities.ts';
import { storeId } from '../collections.ts';
import { distanceM, pinContains, storeGeocodeQueries, walkPrefilterM, type Pin } from '../places.ts';
import { walkRouter } from './walk.ts';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'hatom-shopping-ingest/0.1';
const GAP_MS = 1500; // Nominatim policy: at most 1 request/s; leave headroom.
const MISS_TTL_MS = 86_400_000;

interface LocatableStore {
  chainId: string;
  storeId: string;
  chainSlug: string;
  chainName: string;
  name: string;
  address: string;
  kind: 'physical' | 'online';
  cityId: string | null;
}

type Point = { lat: number; lng: number };

/**
 * Whether the ingest keeps a store without placing it: online stores and
 * stores the owner included in the discovery review are kept (in any target
 * city, pinned or not: a far store is added that way); a store in a city
 * with no pin, or one the review skipped, is dropped; the rest are placed
 * and kept when near a pin.
 */
export function keepRule(
  s: { kind: 'physical' | 'online'; key: string; cityId: string | null },
  ctx: { pinnedCities: ReadonlySet<string>; curated: ReadonlySet<string>; skipped: ReadonlySet<string> },
): 'keep' | 'drop' | 'locate' {
  if (s.kind === 'online' || ctx.curated.has(s.key)) return 'keep';
  if (s.cityId === null || !ctx.pinnedCities.has(s.cityId) || ctx.skipped.has(s.key)) return 'drop';
  return 'locate';
}
// ── a chain with no store near a pin keeps one ───────────────────────────
// Every chain we ingest ends up with at least one priced store (owner's rule,
// 2026-11-18). After the keep pass, a chain with no priced store keeps its
// listed online store, else its physical store nearest any pin (straight
// line), that publishes a PriceFull: the ingest checks fallbackOrder() in
// turn. That store is far (isFar): searchable, never in the walk-limited plans.

export interface FallbackCandidate {
  key: string; // "<chainSlug>/<storeId>"
  storeId: string;
  kind: 'physical' | 'online';
  /** On the chain's onlineStores list (chains.ts). */
  listedOnline: boolean;
  /** Straight-line metres to the nearest pin in any city; null when the store can't be placed. */
  distM: number | null;
  /** In a city with a pin. */
  pinnedCity: boolean;
  /** Skipped in the discovery review: the owner said no to it. */
  skipped: boolean;
}

/**
 * Whether a chain needs its fallback store: none of the stores it kept has
 * prices — neither a PriceFull in today's listing nor prices saved from an
 * earlier run (a store that skips a day keeps yesterday's, so it still counts).
 */
export const needsFallback = (kept: { publishesToday: boolean; savedPrices: boolean }[]) =>
  !kept.some((s) => s.publishesToday || s.savedPrices);

/** The candidates in the order the ingest tries them (the first that publishes a PriceFull wins). */
export function fallbackOrder(cands: FallbackCandidate[]): string[] {
  const rank = (c: FallbackCandidate) => (c.kind === 'online' ? 0 : c.distM !== null ? 1 : c.pinnedCity ? 2 : 3);
  return cands
    .filter((c) => !c.skipped && (c.kind === 'physical' || c.listedOnline))
    .sort((a, b) => rank(a) - rank(b) || (a.distM ?? 0) - (b.distM ?? 0) || Number(a.storeId) - Number(b.storeId) || a.storeId.localeCompare(b.storeId))
    .map((c) => c.key);
}

/** Minutes of slack over a pin's walk limit: two routers disagree by about a minute at the edge. */
export const WALK_SLACK_MIN = 2;

/**
 * Whether a store is far: shown in search, the product view and the store
 * search, never in the walk-limited plans. `cityPins` are the pins in the
 * store's city. Online stores and neighbourhood shops (picked from the
 * walk-limited review) never are.
 */
export function isFar(
  s: { kind: 'physical' | 'online'; chainSlug: string; walkMin: number | null; keptAs?: 'fallback' },
  cityPins: { walkMinutes?: number }[],
): boolean {
  if (s.kind === 'online' || s.chainSlug === 'manual') return false;
  if (s.keptAs === 'fallback' || !cityPins.length) return true;
  const limits = cityPins.flatMap((p) => (p.walkMinutes ? [p.walkMinutes] : []));
  if (!limits.length) return false; // area pins: kept by being inside the area
  return s.walkMin === null || s.walkMin > Math.max(...limits) + WALK_SLACK_MIN;
}

/**
 * The saved fallback stores to keep when the registry is re-filtered (chains
 * not fetched this run, --offline): each one stays while its chain has no
 * other kept store with prices; once a pin reaches a store, the fallback goes.
 */
export function keepFallbacks(
  stores: { key: string; chainSlug: string; keptAs?: 'fallback'; priced: boolean }[],
  kept: ReadonlySet<string>,
): Set<string> {
  const covered = new Set(stores.filter((s) => s.priced && kept.has(s.key) && s.keptAs !== 'fallback').map((s) => s.chainSlug));
  return new Set(stores.filter((s) => s.keptAs === 'fallback' && s.priced && !covered.has(s.chainSlug)).map((s) => s.key));
}

type ReviewRow = { lat: number; lng: number; refs: string[]; official: { chainSlug: string; storeId: string } | null };

/**
 * Official stores the discovery review matched to a mapped shop, as
 * "<chainSlug>/<storeId>" → the row's point. One the owner included in
 * places/decisions.json is on their curated list, so it is kept without
 * re-checking the walk (two routers disagree by a minute at the edge); one
 * they only skipped is left out the same way. A row names one store, but its
 * refs may carry more hand-matches (places/official.json): discovery merges
 * entries at one address — a store and its produce store — so every
 * hand-match of a row's refs counts, at that row's point.
 */
export function curation(rows: ReviewRow[], decisions: Record<string, string>, handMatches: Record<string, string>) {
  const matched = new Map<string, Point>();
  const curated = new Set<string>();
  const skipped = new Set<string>();
  for (const r of rows) {
    const keys = new Set(r.refs.map((ref) => handMatches[ref]).filter(Boolean));
    if (r.official) keys.add(`${r.official.chainSlug}/${r.official.storeId}`);
    const included = r.refs.some((ref) => decisions[ref] === 'include');
    const skip = !included && r.refs.some((ref) => decisions[ref] === 'skip');
    for (const k of keys) {
      matched.set(k, { lat: r.lat, lng: r.lng });
      if (included) curated.add(k);
      else if (skip) skipped.add(k);
    }
  }
  for (const k of curated) skipped.delete(k); // two rows can match one store
  return { matched, curated, skipped };
}

/** A hit is kept forever; a miss (`p: null`) only for MISS_TTL_MS. */
type GeocodeCache = Record<string, { p: Point | null; at: string }>;

const readJson = <T,>(p: string, fallback: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : fallback);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PinFilter {
  pins: Pin[];
  /** Official stores ("<chainSlug>/<storeId>") the owner skipped in the review. */
  skipped: ReadonlySet<string>;
  /** Straight-line metres from a point to the nearest pin in any city. */
  nearestPinM(at: Point): number;
  /** Whether the store is near a pin; logs every store it can't place. */
  keep(stores: LocatableStore[], warn: (msg: string) => void): Promise<Set<string>>;
  /** Whether a point is within one of the city's pins (walking time when the pin sets one). */
  near(cityId: string | null, at: Point): Promise<boolean>;
  /** Where an official store is: the discovery match, else its cached or looked-up address. */
  pointOf(store: LocatableStore): Promise<Point | null>;
  /** Routed walking minutes from the nearest of the city's pins (rounded up), or null. */
  walkMinutes(cityId: string | null, at: Point): Promise<number | null>;
}

/** null when there's no pins.json: the ingest then keeps whole target cities. */
export function pinFilter(placesDir: string): PinFilter | null {
  const pins = readJson<Pin[]>(join(placesDir, 'pins.json'), []);
  if (!pins.length) return null;
  const rings = new Map(
    pins.filter((p) => p.osmArea).map((p) => [p.id, readJson<{ coordinates: [number, number][][] } | null>(join(placesDir, `${p.osmArea}.geojson`), null)?.coordinates[0] ?? null]),
  );

  const { matched, curated, skipped } = curation(
    pins.flatMap((pin) => readJson<ReviewRow[]>(join(placesDir, `${pin.id}.review.json`), [])),
    readJson<Record<string, string>>(join(placesDir, 'decisions.json'), {}),
    readJson<Record<string, string>>(join(placesDir, 'official.json'), {}),
  );

  const cachePath = join(placesDir, 'geocode.json');
  const cache = readJson<GeocodeCache>(cachePath, {});
  for (const [k, v] of Object.entries(cache) as [string, unknown][]) {
    // First cache format stored the point (or null) directly.
    if (!v || !('at' in (v as object))) cache[k] = { p: (v as Point | null) ?? null, at: v ? new Date().toISOString() : '1970-01-01' };
  }
  let last = 0;
  async function geocode(q: string): Promise<Point | null> {
    const c = cache[q];
    if (c && (c.p || Date.now() - Date.parse(c.at) < MISS_TTL_MS)) return c.p;
    const url = `${NOMINATIM}?${new URLSearchParams({ q, format: 'jsonv2', limit: '1', countrycodes: 'il' })}`;
    for (let attempt = 1; ; attempt++) {
      const wait = last + GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'he' } });
      if (res.ok) {
        const [hit] = (await res.json()) as { lat: string; lon: string }[];
        cache[q] = { p: hit ? { lat: +hit.lat, lng: +hit.lon } : null, at: new Date().toISOString() };
        writeFileSync(cachePath, JSON.stringify(cache, null, 1));
        return cache[q].p;
      }
      // 429/503 = slow down: back off 10 s, 20 s, 40 s, then treat as unplaceable for this run.
      if ((res.status !== 429 && res.status !== 503) || attempt > 3) return null;
      await sleep(10_000 * 2 ** (attempt - 1));
    }
  }

  const walkSeconds = walkRouter(placesDir);
  async function near(cityId: string | null, at: Point): Promise<boolean> {
    for (const p of pins.filter((x) => x.city === cityId)) {
      if (p.walkMinutes) {
        if (distanceM(p, at) > walkPrefilterM(p)) continue;
        const s = await walkSeconds(p, at);
        if (s !== null && s <= p.walkMinutes * 60) return true;
      } else if (pinContains(p, rings.get(p.id) ?? null, at)) {
        return true;
      }
    }
    return false;
  }

  async function pointOf(s: LocatableStore): Promise<Point | null> {
    const m = matched.get(`${s.chainSlug}/${s.storeId}`);
    if (m) return m;
    const city = CITIES.find((c) => c.id === s.cityId);
    if (!city) return null;
    for (const q of storeGeocodeQueries(s, city.name.replace('-יפו', ''))) {
      const at = await geocode(q);
      if (at) return at;
    }
    return null;
  }

  async function walkMinutes(cityId: string | null, at: Point): Promise<number | null> {
    let best: number | null = null;
    for (const p of pins.filter((x) => x.city === cityId)) {
      const s = await walkSeconds(p, at);
      if (s !== null && (best === null || s < best)) best = s;
    }
    return best === null ? null : Math.max(1, Math.ceil(best / 60));
  }

  return {
    pins,
    skipped,
    nearestPinM: (at) => Math.round(Math.min(...pins.map((p) => distanceM(p, at)))),
    near,
    pointOf,
    walkMinutes,
    async keep(stores, warn) {
      const out = new Set<string>();
      const pinnedCities = new Set(pins.map((p) => p.city));
      for (const s of stores) {
        const rule = keepRule({ kind: s.kind, key: `${s.chainSlug}/${s.storeId}`, cityId: s.cityId }, { pinnedCities, curated, skipped });
        if (rule === 'keep') out.add(storeId(s));
        if (rule !== 'locate') continue;
        const cityPins = pins.filter((p) => p.city === s.cityId);
        const city = CITIES.find((c) => c.id === s.cityId)!;
        const queries = storeGeocodeQueries(s, city.name.replace('-יפו', ''));
        let at = matched.get(`${s.chainSlug}/${s.storeId}`) ?? null;
        for (const q of queries) {
          if (at) break;
          at = await geocode(q);
        }
        if (!at) {
          const strict = cityPins.some((p) => p.walkMinutes);
          warn(`${s.chainSlug} store ${s.storeId} (${s.name} / ${s.address}): can't place it (tried ${queries.map((q) => `"${q}"`).join(', ') || 'nothing'}); ${strict ? 'left out' : 'kept'}`);
          if (!strict) out.add(storeId(s));
          continue;
        }
        if (await near(s.cityId, at)) out.add(storeId(s));
      }
      return out;
    },
  };
}
