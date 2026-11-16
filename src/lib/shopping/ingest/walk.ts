// Walking time between two points, from the OpenStreetMap foot router
// (routing.openstreetmap.de, OSRM "foot" profile — a free community service:
// one request per second, results cached forever per point pair in
// places/walk.json, so a store is routed once per pin).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const USER_AGENT = 'hatom-shopping-ingest/0.1';
const GAP_MS = 1100;

type Point = { lat: number; lng: number };
const key = (a: Point, b: Point) => [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(5)).join(',');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function walkRouter(placesDir: string) {
  const path = join(placesDir, 'walk.json');
  const cache: Record<string, { s: number; m: number } | null> = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  let last = 0;
  /** Walking seconds from `a` to `b`, or null when the router finds no route / fails. */
  return async function walkSeconds(a: Point, b: Point): Promise<number | null> {
    const k = key(a, b);
    if (k in cache) return cache[k]?.s ?? null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const wait = last + GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const res = await fetch(`${ROUTER}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { headers: { 'User-Agent': USER_AGENT } }).catch(() => null);
      if (res?.ok) {
        const j = (await res.json()) as { code: string; routes?: { duration: number; distance: number }[] };
        const r = j.code === 'Ok' ? j.routes?.[0] : undefined;
        cache[k] = r ? { s: Math.round(r.duration), m: Math.round(r.distance) } : null;
        writeFileSync(path, JSON.stringify(cache));
        return cache[k]?.s ?? null;
      }
      await sleep(5000 * attempt); // transient failure: don't cache, back off
    }
    return null;
  };
}
