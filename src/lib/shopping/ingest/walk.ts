// Walking time between two points, from the OpenStreetMap foot router
// (routing.openstreetmap.de, OSRM "foot" profile — a free community service:
// one request at a time, REQUEST_GAP_MS apart; results cached forever per
// point pair in places/walk.json, so a store is routed once per pin).

import { join } from 'node:path';
import { REQUEST_GAP_MS, readJson, sleep as realSleep, writeJson } from './cache.ts';
import type { NetDeps } from './geo.ts';

const ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const USER_AGENT = 'hatom-shopping-ingest/0.1';

type Point = { lat: number; lng: number };
const key = (a: Point, b: Point) => [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(5)).join(',');

/**
 * Walking seconds from `a` to `b`; null when the router finds no route or
 * fails. `'uncached'`: the pair was never routed and the run is offline.
 */
export type WalkSeconds = (a: Point, b: Point) => Promise<number | null | 'uncached'>;

export function walkRouter(placesDir: string, opts: { offline?: boolean } & NetDeps = {}): WalkSeconds {
  const { offline = false, fetch = globalThis.fetch, sleep = realSleep, now = Date.now } = opts;
  const path = join(placesDir, 'walk.json');
  const cache = readJson<Record<string, { s: number; m: number } | null>>(path, {});
  let last = -Infinity;
  return async function walkSeconds(a, b) {
    const k = key(a, b);
    if (k in cache) return cache[k]?.s ?? null;
    if (offline) return 'uncached';
    for (let attempt = 1; attempt <= 3; attempt++) {
      const wait = last + REQUEST_GAP_MS - now();
      if (wait > 0) await sleep(wait);
      last = now();
      const res = await fetch(`${ROUTER}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { headers: { 'User-Agent': USER_AGENT } }).catch(() => null);
      if (res?.ok) {
        const j = (await res.json()) as { code: string; routes?: { duration: number; distance: number }[] };
        const r = j.code === 'Ok' ? j.routes?.[0] : undefined;
        cache[k] = r ? { s: Math.round(r.duration), m: Math.round(r.distance) } : null;
        writeJson(path, cache);
        return cache[k]?.s ?? null;
      }
      await sleep(5000 * attempt); // transient failure: don't cache, back off
    }
    return null;
  };
}
