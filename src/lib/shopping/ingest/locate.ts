// Places stores for the selection stage (ingest/select.ts). Official store
// files carry addresses but no coordinates, so a store is placed by (1) the
// discovery review's match of a mapped shop to that store, else (2) a
// Nominatim lookup of its address, cached per query in places/geocode.json:
// a hit forever, a miss for 30 days (it used to be one day, and every run
// spent minutes re-asking questions Nominatim can't answer).
//
// A point is near a pin when it is within the pin's walk (a routed walking
// time, ingest/walk.ts) or, for a pin with no `walkMinutes`, inside its
// circle or area.
//
// An --offline run makes no request: lookups and walks answer from their
// caches only, and one that isn't cached is `'uncached'`, never a miss.

import { join } from 'node:path';
import { CITIES } from '../cities.ts';
import { distanceM, pinContains, storeGeocodeQueries, walkPrefilterM, type Pin } from '../places.ts';
import { readJson, writeJson } from './cache.ts';
import { NominatimError, nominatim, type NetDeps } from './geo.ts';
import type { Picks, Point } from './picks.ts';
import { walkRouter, type WalkSeconds } from './walk.ts';

const USER_AGENT = 'hatom-shopping-ingest/0.1';
/** How long a miss stands before the address is asked again. */
export const MISS_TTL_MS = 30 * 86_400_000;

export interface LocatableStore {
  chainId: string;
  storeId: string;
  chainSlug: string;
  chainName: string;
  name: string;
  address: string;
  kind: 'physical' | 'online';
  cityId: string | null;
}

/** places/geocode.json: query → the point (`p: null` = a miss) and when it was asked. */
export type GeocodeCache = Record<string, { p: Point | null; at: string }>;

/** An address lookup: the point, null for a miss, `'uncached'` when offline and never asked. */
export type Geocode = (query: string) => Promise<Point | null | 'uncached'>;

export function geocoder(d: {
  cache: GeocodeCache;
  /** Called after an answer was added to `cache`. */
  save(): void;
  /** Asks Nominatim: the first hit's point, or null. Throws NominatimError when it refuses. */
  search(query: string): Promise<Point | null>;
  offline: boolean;
  now?: () => number;
}): Geocode {
  const now = d.now ?? Date.now;
  return async (q) => {
    const c = d.cache[q];
    // Offline, a miss of any age stands: it can't be asked again.
    if (c && (c.p || d.offline || now() - Date.parse(c.at) < MISS_TTL_MS)) return c.p;
    if (d.offline) return 'uncached';
    let p: Point | null;
    try {
      p = await d.search(q);
    } catch (e) {
      // Still refused after the back-off: unplaceable for this run, and not cached.
      if (e instanceof NominatimError) return null;
      throw e;
    }
    d.cache[q] = { p, at: new Date(now()).toISOString() };
    d.save();
    return p;
  };
}

/**
 * Places stores. `'uncached'` = the answer is not in the cache and the run
 * may not ask for it (an offline run): the caller keeps the saved verdict.
 */
export interface Locator {
  /** Where an official store is: the discovery match, else its cached or looked-up address; null when it can't be placed. */
  pointOf(store: LocatableStore): Promise<Point | null | 'uncached'>;
  /** The address lookups pointOf tries for a store, for the log. */
  queriesOf(store: LocatableStore): string[];
  /** Whether a point is within one of the city's pins (walking time when the pin sets one). */
  near(cityId: string | null, at: Point): Promise<boolean | 'uncached'>;
  /** Straight-line metres from a point to the nearest pin in any city. */
  nearestPinM(at: Point): number;
}

/** The locator over given lookups: no files, no network of its own. */
export function makeLocator(d: {
  pins: Pin[];
  rings: Map<string, [number, number][] | null>;
  /** Official store ref → the point of the review row matched to it (picks.curation().matched). */
  matched: ReadonlyMap<string, Point>;
  geocode: Geocode;
  walkSeconds: WalkSeconds;
}): Locator {
  const { pins, rings, matched, geocode, walkSeconds } = d;

  function queriesOf(s: LocatableStore): string[] {
    const city = CITIES.find((c) => c.id === s.cityId);
    return city ? storeGeocodeQueries(s, city.name.replace('-יפו', '')) : [];
  }

  async function pointOf(s: LocatableStore): Promise<Point | null | 'uncached'> {
    const m = matched.get(`${s.chainSlug}/${s.storeId}`);
    if (m) return m;
    // Best query first; the first that answers with a point wins. An uncached
    // one stops the search: a later query's hit could be the wrong answer.
    for (const q of queriesOf(s)) {
      const at = await geocode(q);
      if (at) return at;
    }
    return null;
  }

  async function near(cityId: string | null, at: Point): Promise<boolean | 'uncached'> {
    let uncached = false;
    for (const p of pins.filter((x) => x.city === cityId)) {
      if (p.walkMinutes) {
        if (distanceM(p, at) > walkPrefilterM(p)) continue;
        const s = await walkSeconds(p, at);
        if (s === 'uncached') uncached = true;
        else if (s !== null && s <= p.walkMinutes * 60) return true;
      } else if (pinContains(p, rings.get(p.id) ?? null, at)) {
        return true;
      }
    }
    return uncached ? 'uncached' : false;
  }

  return { pointOf, queriesOf, near, nearestPinM: (at) => Math.round(Math.min(...pins.map((p) => distanceM(p, at)))) };
}

/** The locator over the cache files in places/ (geocode.json, walk.json). */
export function locator(placesDir: string, picks: Picks, opts: { offline: boolean } & NetDeps): Locator {
  const cachePath = join(placesDir, 'geocode.json');
  const cache = readJson<GeocodeCache>(cachePath, {});
  const search = nominatim(USER_AGENT, opts);
  return makeLocator({
    pins: picks.pins,
    rings: picks.rings,
    matched: picks.curation().matched,
    geocode: geocoder({
      cache,
      save: () => writeJson(cachePath, cache, 1),
      offline: opts.offline,
      now: opts.now,
      search: async (q) => {
        const [hit] = await search<{ lat: string; lon: string }>({ q, format: 'jsonv2', limit: '1', countrycodes: 'il' });
        return hit ? { lat: +hit.lat, lng: +hit.lon } : null;
      },
    }),
    walkSeconds: walkRouter(placesDir, opts),
  });
}
