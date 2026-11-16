// Keeps the price ingest to the stores near the pins (places/pins.json):
// official store files carry addresses but no coordinates, so each store is
// placed by (1) the discovery review's match of a mapped shop to that store,
// else (2) a Nominatim lookup of its address, cached forever per query in
// places/geocode.json (a miss is retried after a day: Nominatim answers []
// while it throttles a client). Online stores are not location-bound and always
// pass; a store that still can't be placed is kept and logged — keeping one
// extra store costs a little space, dropping one near a pin loses it.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CITIES } from '../cities.ts';
import { storeId } from '../collections.ts';
import { pinContains, storeGeocodeQueries, type Pin } from '../places.ts';

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
/** A hit is kept forever; a miss (`p: null`) only for MISS_TTL_MS. */
type GeocodeCache = Record<string, { p: Point | null; at: string }>;

const readJson = <T,>(p: string, fallback: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : fallback);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PinFilter {
  pins: Pin[];
  /** Whether the store is near a pin; logs every store it can't place. */
  keep(stores: LocatableStore[], warn: (msg: string) => void): Promise<Set<string>>;
}

/** null when there's no pins.json: the ingest then keeps whole target cities. */
export function pinFilter(placesDir: string): PinFilter | null {
  const pins = readJson<Pin[]>(join(placesDir, 'pins.json'), []);
  if (!pins.length) return null;
  const rings = new Map(
    pins.filter((p) => p.osmArea).map((p) => [p.id, readJson<{ coordinates: [number, number][][] } | null>(join(placesDir, `${p.osmArea}.geojson`), null)?.coordinates[0] ?? null]),
  );

  // Official stores the discovery review matched to a mapped shop.
  const matched = new Map<string, Point>();
  for (const pin of pins) {
    const rows = readJson<{ lat: number; lng: number; official: { chainSlug: string; storeId: string } | null }[]>(join(placesDir, `${pin.id}.review.json`), []);
    for (const r of rows) if (r.official) matched.set(`${r.official.chainSlug}/${r.official.storeId}`, { lat: r.lat, lng: r.lng });
  }

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

  return {
    pins,
    async keep(stores, warn) {
      const out = new Set<string>();
      for (const s of stores) {
        if (s.kind === 'online') {
          out.add(storeId(s));
          continue;
        }
        const cityPins = pins.filter((p) => p.city === s.cityId);
        if (!cityPins.length) continue;
        const city = CITIES.find((c) => c.id === s.cityId)!;
        const queries = storeGeocodeQueries(s, city.name.replace('-יפו', ''));
        let at = matched.get(`${s.chainSlug}/${s.storeId}`) ?? null;
        for (const q of queries) {
          if (at) break;
          at = await geocode(q);
        }
        if (!at) {
          warn(`${s.chainSlug} store ${s.storeId} (${s.name} / ${s.address}): can't place it (tried ${queries.map((q) => `"${q}"`).join(', ') || 'nothing'}); kept`);
          out.add(storeId(s));
          continue;
        }
        if (cityPins.some((p) => pinContains(p, rings.get(p.id) ?? null, at))) out.add(storeId(s));
      }
      return out;
    },
  };
}
