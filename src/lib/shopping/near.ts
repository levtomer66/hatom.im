// Which stores count for a person (docs/superpowers/specs/2026-11-18-shopping-no-cities-design.md):
// physical stores within a straight-line radius of the centre (the live
// location, else the household's home spot), plus the household's ★
// favorites wherever they are, plus every online store. Pure and
// import-free (node --test).

export const RADII_KM = [1, 2, 5, 10] as const;
export const DEFAULT_RADIUS_KM = 1;
/** "אני בסופר"'s store picker lists stores this far from you. */
export const PICKER_RADIUS_KM = 10;

export interface Centre { lat: number; lng: number }
export type WhereSource = 'live' | 'home' | 'none';
export interface Where { centre: Centre | null; source: WhereSource; radiusKm: number }
/** The household's favorite stores, at most (home.ts re-exports it). */
export const MAX_FAV_STORES = 10;

/**
 * The favorites a request counts: the page's current ones when it sends a
 * valid list (a star just tapped counts before its debounced save lands;
 * deduped, capped), else the household's saved ones. Read-only use: pricing.
 */
export function pickFavs(given: unknown, saved: number[]): number[] {
  if (!Array.isArray(given) || !given.every((k) => Number.isInteger(k))) return saved;
  return [...new Set(given as number[])].slice(0, MAX_FAV_STORES);
}

/** A request's near set, before the stores are loaded: where, and the household's favorites. */
export interface Near { where: Where; favs: number[] }

const EARTH_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: Centre, b: Centre): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

const absent = (v: unknown) => v === undefined || v === null || v === '';
const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN);
/** 4 decimals ≈ 11 m: plenty for a radius of 1 km, and kinder to caches. */
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

/**
 * A point from request input (numbers or numeric strings): null when both
 * are absent, an error string when only one is given or either is not a
 * coordinate.
 */
export function parseCentre(lat: unknown, lng: unknown): Centre | null | string {
  if (absent(lat) && absent(lng)) return null;
  if (absent(lat) || absent(lng)) return 'lat and lng go together';
  const a = num(lat);
  const b = num(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return 'bad lat/lng';
  return { lat: round4(a), lng: round4(b) };
}

/** One of RADII_KM; anything else (an old client, a typo) is the default, not an error. */
export function parseRadius(raw: unknown): number {
  const r = num(raw);
  return (RADII_KM as readonly number[]).includes(r) ? r : DEFAULT_RADIUS_KM;
}

export function resolveWhere(live: Centre | null, home: Centre | null, radiusKm: number): Where {
  if (live) return { centre: live, source: 'live', radiusKm };
  if (home) return { centre: home, source: 'home', radiusKm };
  return { centre: null, source: 'none', radiusKm };
}

/**
 * The near set, in input order: online stores; physical stores that are ★
 * or have a point within the radius. A store without a point counts only
 * when starred. Physical stores carry `distM` from the centre (null without
 * a point or a centre); online ones null.
 */
export function nearStores<S extends { k: number; kind: 'physical' | 'online'; loc: Centre | null }>(
  stores: S[],
  where: Where,
  favs: number[],
): (S & { distM: number | null })[] {
  const fav = new Set(favs);
  const limit = where.radiusKm * 1000;
  const out: (S & { distM: number | null })[] = [];
  for (const s of stores) {
    if (s.kind === 'online') {
      out.push({ ...s, distM: null });
      continue;
    }
    const distM = where.centre && s.loc ? Math.round(distanceM(where.centre, s.loc)) : null;
    if (fav.has(s.k) || (distM !== null && distM <= limit)) out.push({ ...s, distM });
  }
  return out;
}

/**
 * A store the plans ("הכי זול" / "חנות אחת") may use: measured from the centre
 * and within the radius. Favorites farther away, or with no point, are listed
 * and priced but never win a plan (owner, 2026-11-18).
 */
export function withinRadius(s: { distM: number | null }, where: Where): boolean {
  return s.distM !== null && s.distM <= where.radiusKm * 1000;
}

/** Streets aren't straight: a walk is about this much longer than the straight line. */
const DETOUR = 1.3;
const WALK_M_PER_MIN = 80;

/** Estimated walking minutes for a straight-line distance (at least 1). */
export function walkMinutes(m: number): number {
  return Math.max(1, Math.round((m * DETOUR) / WALK_M_PER_MIN));
}

/**
 * A split plan's stops as a walk: nearest to the centre first (without a
 * centre, the first stop given), then each time the stop nearest to the last
 * one; stops with no point go last, in the order given. `legs[i]` is metres
 * from the previous point (the centre for the first) to `order[i]`, null when
 * either end has no point; `total` is their sum, null unless every leg is known.
 */
export function walkOrder(
  centre: Centre | null,
  stops: { store: number; loc: Centre | null }[],
): { order: number[]; legs: (number | null)[]; total: number | null } {
  const placed = stops.filter((s) => s.loc) as { store: number; loc: Centre }[];
  const rest = stops.filter((s) => !s.loc);
  const order: { store: number; loc: Centre | null }[] = [];
  let at: Centre | null = centre;
  const left = [...placed];
  while (left.length) {
    let i = 0;
    if (at) {
      const from = at;
      left.forEach((s, j) => { if (distanceM(from, s.loc) < distanceM(from, left[i].loc)) i = j; });
    }
    const [next] = left.splice(i, 1);
    order.push(next);
    at = next.loc;
  }
  order.push(...rest);
  const legs = order.map((s, i) => {
    const prev = i === 0 ? centre : order[i - 1].loc;
    return prev && s.loc ? Math.round(distanceM(prev, s.loc)) : null;
  });
  const total = legs.every((l) => l !== null) ? legs.reduce<number>((a, b) => a + (b ?? 0), 0) : null;
  return { order: order.map((s) => s.store), legs, total };
}
