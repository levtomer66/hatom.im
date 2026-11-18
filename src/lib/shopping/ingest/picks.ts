// The owner's picks: every file under places/ that says which stores the
// ingest keeps, read once per run (loadPicks) into one object.
//
//   pins.json            the pins (personal locations), and <osmArea>.geojson per area pin
//   <pin>.review.json    discovery's rows for the pin (written by ingest/discover.ts)
//   decisions.json       { [placeRef]: "include" | "skip" }
//   official.json        { [placeRef]: "<chainSlug>/<storeId>" } — hand matches
//   wolt.json            the Wolt venues (ingest/wolt.ts WoltVenueConfig)
//
// The derived views (curation, placePoint, manualShops) are pure functions of
// that data: a test builds a Picks from literals with makePicks().

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { isTargetCity } from '../cities.ts';
import { placeCity, type OfficialStore, type Pin, type Place } from '../places.ts';
import { readJson } from './cache.ts';
import type { WoltVenueConfig } from './wolt.ts';

export type Point = { lat: number; lng: number };

/** One row of <pin>.review.json: a discovered shop and what is known about its prices. */
export interface ReviewRow extends Place {
  /** ingested = matched to an official store we fetch; publishes = its retailer publishes files; none = no data. */
  status: 'ingested' | 'publishes' | 'none';
  retailer: string | null;
  official: OfficialStore | null;
  decision: 'include' | 'skip' | 'pending';
}

export interface PicksData {
  pins: Pin[];
  /** Area pins: pin id → the outline's outer ring, or null when its geojson is missing. */
  rings: Map<string, [number, number][] | null>;
  /** Every pin's review rows, in pins.json order. */
  reviews: { pin: Pin; rows: ReviewRow[] }[];
  decisions: Record<string, string>;
  handMatches: Record<string, string>;
  woltVenues: WoltVenueConfig[];
}

/** A neighbourhood shop with no price source: listed with no items, users type its prices. */
export interface ManualShop {
  /** sha1 of the review row id, first 10 hex chars: stable across runs. */
  id: string;
  name: string;
  address: string;
  city: string;
  at: Point;
}

export interface Curation {
  /** Official store ref "<chainSlug>/<storeId>" → the point of the review row matched to it. */
  matched: Map<string, Point>;
  /** Official stores the owner included: kept wherever they are. */
  curated: Set<string>;
  /** Official stores the owner skipped: left out. */
  skipped: Set<string>;
}

export interface Picks extends PicksData {
  /** Cities with a pin. */
  pinnedCities: ReadonlySet<string>;
  /** Whether the owner included this discovery place. */
  included(placeRef: string): boolean;
  curation(): Curation;
  /** Where a discovery place is: the point of the review row that lists it. */
  placePoint(placeRef: string): Point | undefined;
  manualShops(): ManualShop[];
}

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
export function curation(
  rows: { lat: number; lng: number; refs: string[]; official: { chainSlug: string; storeId: string } | null }[],
  decisions: Record<string, string>,
  handMatches: Record<string, string>,
): Curation {
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

/**
 * Shops the owner marked "include" in the discovery review that have no
 * ingested price source: not an official store we fetch, and not a Wolt venue
 * (a venue with `manualToo` sells only part of the shop on Wolt, e.g. just
 * produce, so the shop stays). The decisions are the owner's curated list
 * (checked against the walk limit when it was made), so they are not
 * re-checked: two routers disagree by a minute at the edge.
 */
function manualShops(d: PicksData): ManualShop[] {
  const woltPlaces = new Set(d.woltVenues.filter((v) => !v.manualToo).map((v) => v.placeId).filter(Boolean));
  const out = new Map<string, ManualShop>();
  for (const { pin, rows } of d.reviews) {
    for (const r of rows) {
      // A shop added under another city's pin carries its own city (places/extra.json).
      const city = placeCity(r, pin);
      if (!isTargetCity(city)) continue;
      if (r.status === 'ingested' || !r.refs.some((ref) => d.decisions[ref] === 'include')) continue;
      if (r.refs.some((ref) => woltPlaces.has(ref))) continue;
      const id = createHash('sha1').update(r.id).digest('hex').slice(0, 10);
      out.set(id, { id, name: r.name, address: r.address, city, at: { lat: r.lat, lng: r.lng } });
    }
  }
  return [...out.values()];
}

export function makePicks(d: PicksData): Picks {
  let curated: Curation | undefined;
  let points: Map<string, Point> | undefined;
  let shops: ManualShop[] | undefined;
  return {
    ...d,
    pinnedCities: new Set(d.pins.map((p) => p.city)),
    included: (ref) => d.decisions[ref] === 'include',
    curation: () => (curated ??= curation(d.reviews.flatMap((r) => r.rows), d.decisions, d.handMatches)),
    placePoint(ref) {
      if (!points) {
        points = new Map();
        for (const { rows } of d.reviews) for (const r of rows) for (const x of r.refs) points.set(x, { lat: r.lat, lng: r.lng });
      }
      return points.get(ref);
    },
    manualShops: () => (shops ??= manualShops(d)),
  };
}

/** Reads each of the owner's files once. No pins is an error: the ingest has no mode without them. */
export function loadPicks(placesDir: string): Picks {
  const pinsFile = join(placesDir, 'pins.json');
  const pins = readJson<Pin[]>(pinsFile, []);
  if (!pins.length) throw new Error(`no pins: create ${pinsFile} (see the header of ingest/discover.ts)`);
  return makePicks({
    pins,
    rings: new Map(
      pins.filter((p) => p.osmArea).map((p) => [p.id, readJson<{ coordinates: [number, number][][] } | null>(join(placesDir, `${p.osmArea}.geojson`), null)?.coordinates[0] ?? null]),
    ),
    reviews: pins.map((pin) => ({ pin, rows: readJson<ReviewRow[]>(join(placesDir, `${pin.id}.review.json`), []) })),
    decisions: readJson<Record<string, string>>(join(placesDir, 'decisions.json'), {}),
    handMatches: readJson<Record<string, string>>(join(placesDir, 'official.json'), {}),
    woltVenues: readJson<WoltVenueConfig[]>(join(placesDir, 'wolt.json'), []),
  });
}
