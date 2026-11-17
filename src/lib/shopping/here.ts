// "אני בחנות" (docs/shopping-here-mode.md): what's worth buying at the store
// you're standing in. The verdict for one item, the grouping of the lists'
// items, merging the lists and sorting stores by distance. Import-free apart
// from types, for `node --test`.

import type { HereRow, HereStore } from './api-types.ts';

export type { HereRow, HereStore } from './api-types.ts';

/** Within this of the cheapest (per unit, agorot) counts as "the cheapest": max(₪0.50, 3%). */
export const HERE_TIE_MIN = 50;
export const HERE_TIE_PCT = 0.03;
/** Cheaper elsewhere by at least this for the list's quantity (agorot) = worth going there. */
export const HERE_WORTH_WALK = 300;
/** A remembered store is reopened for this long. */
export const HERE_REMEMBER_MS = 2 * 60 * 60 * 1000;
/** The nearest store within this many metres is suggested ("נראה שאתה ב…"). */
export const HERE_NEAR_M = 80;

/** best: buy it here · ok: cheaper elsewhere, not worth the walk · elsewhere: worth the walk · missing: not sold here. */
export type HereGroup = 'best' | 'ok' | 'elsewhere' | 'missing';

export const HERE_GROUPS: HereGroup[] = ['best', 'ok', 'elsewhere', 'missing'];

export const tieOf = (bestUnit: number) => Math.max(HERE_TIE_MIN, Math.round(bestUnit * HERE_TIE_PCT));

/**
 * Where an item stands here: its unit price here and the cheapest unit price
 * among the city's stores (deals applied; null = no store / not this store),
 * and the quantity wanted. `saving` is what the cheapest store saves on that
 * quantity, agorot (0 for 'best' and 'missing').
 */
export function verdict(here: number | null, best: number | null, qty = 1): { group: HereGroup; saving: number } {
  if (here === null) return { group: 'missing', saving: 0 };
  if (best === null || here - best <= tieOf(best)) return { group: 'best', saving: 0 };
  const saving = Math.round((here - best) * qty);
  return { group: saving >= HERE_WORTH_WALK ? 'elsewhere' : 'ok', saving };
}

/** Group rows; inside a group the biggest saving first, then by key for a stable order. */
export function groupHere(rows: HereRow[]): Record<HereGroup, HereRow[]> {
  const out: Record<HereGroup, HereRow[]> = { best: [], ok: [], elsewhere: [], missing: [] };
  for (const r of rows) out[r.group].push(r);
  for (const g of HERE_GROUPS) out[g].sort((a, b) => b.saving - a.saving || a.key.localeCompare(b.key));
  return out;
}

/** Each item once across the lists: the largest quantity wanted, and every list it's on. */
export function mergeLists(lists: { id: string; items: { key: string; qty: number }[] }[]): { key: string; qty: number; listIds: string[] }[] {
  const byKey = new Map<string, { key: string; qty: number; listIds: string[] }>();
  for (const l of lists) {
    for (const i of l.items) {
      const cur = byKey.get(i.key);
      if (!cur) byKey.set(i.key, { key: i.key, qty: i.qty, listIds: [l.id] });
      else {
        cur.qty = Math.max(cur.qty, i.qty);
        if (!cur.listIds.includes(l.id)) cur.listIds.push(l.id);
      }
    }
  }
  return [...byKey.values()];
}

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in metres (the same formula as places.ts' distanceM). */
export function metresBetween(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * Stores for the picker with their distance from `me` (null without a
 * position or a location): nearest first; stores without a distance after
 * them, by walking time from the pins, then by name.
 */
export function sortStores<S extends HereStore>(stores: S[], me: LatLng | null): (S & { distM: number | null })[] {
  return stores
    .map((s) => ({ ...s, distM: me && s.loc ? Math.round(metresBetween(me, s.loc)) : null }))
    .sort((a, b) => {
      if (a.distM !== null || b.distM !== null) {
        if (a.distM === null) return 1;
        if (b.distM === null) return -1;
        if (a.distM !== b.distM) return a.distM - b.distM;
      }
      const wa = a.walkMin ?? Infinity;
      const wb = b.walkMin ?? Infinity;
      if (wa !== wb) return wa - wb;
      return `${a.chainName} ${a.name}`.localeCompare(`${b.chainName} ${b.name}`, 'he');
    });
}

/** The store to suggest: the nearest, if it's within HERE_NEAR_M. */
export function nearbyStore<S extends { distM: number | null }>(sorted: S[]): S | null {
  const first = sorted[0];
  return first && first.distM !== null && first.distM <= HERE_NEAR_M ? first : null;
}

/** "120 מ׳" / "1.4 ק״מ". */
export function distanceLabel(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} מ׳`;
  return `${(m / 1000).toFixed(1)} ק״מ`;
}

/**
 * The deal finisher: a multi-buy deal on the item at this store that the
 * list's quantity doesn't reach ("3 ב־₪20", list has 2) → how many to add.
 * Null when there's none, when the item is weighed, or when it needs more than 5.
 */
export function dealGap(minQty: number | null, qty: number, w: boolean): number | null {
  if (w || minQty === null || minQty <= 1) return null;
  const add = Math.ceil(minQty - qty);
  return add > 0 && add <= 5 ? add : null;
}

/** When a deal ends, from "now" (both Israel local "YYYY-MM-DDTHH:mm"): "נגמר היום", "נגמר מחר", or "עד 24.11". */
export function endsLabel(end: string, now: string): string {
  const day = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86_400_000;
  const diff = day(end) - day(now);
  if (diff <= 0) return 'נגמר היום';
  if (diff === 1) return 'נגמר מחר';
  return `עד ${Number(end.slice(8, 10))}.${Number(end.slice(5, 7))}`;
}

/** Name words worth matching on: 3+ letters, no digits, without quote marks. */
const nameWords = (s: string) =>
  s.split(/[\s,./*+()\-]+/).map((w) => w.replace(/["'״׳%]/g, '')).filter((w) => w.length >= 3 && !/\d/.test(w));

/**
 * Whether `candidate` can stand in for `name` as "a cheaper twin here": it
 * shares a word that isn't the maker's (a brand alone, "סנו", would offer
 * dish soap for paper towels).
 */
export function isTwin(name: string, maker: string, candidate: string): boolean {
  const brand = new Set(nameWords(maker));
  const own = new Set(nameWords(name).filter((w) => !brand.has(w)));
  return nameWords(candidate).some((w) => own.has(w));
}
