// Small-store discovery around pinned locations: geometry, merging the
// OpenStreetMap and Google Maps listings, and telling which shops already
// publish official price files. Pure and import-free (node --test).
//
// Pins themselves are personal (home, work) and live in the cache dir,
// never in the repo: $SHOPPING_CACHE_DIR/places/pins.json.

import { distanceM } from './near.ts';

export { distanceM };

const EARTH_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export interface Pin {
  id: string;
  label: string;
  lat: number;
  lng: number;
  /** Circle pins. */
  radiusM?: number;
  /** Area pins: an OSM element id like "W817274798"; its outline is cached next to pins.json. */
  osmArea?: string;
  /** Target city id (cities.ts) the pin sits in. */
  city: string;
  /**
   * Keep only stores within this many minutes' walk of lat/lng (walking route,
   * not straight line). Takes precedence over radiusM / osmArea for the ingest;
   * discovery still uses the radius or area to list candidates.
   */
  walkMinutes?: number;
}

/** Brisk walking upper bound, m/s: no route can be faster, so it prefilters before routing. */
export const MAX_WALK_SPEED = 1.5;

/** The straight-line distance beyond which a store can't be within the pin's walk. */
export const walkPrefilterM = (pin: Pin) => (pin.walkMinutes ?? 0) * 60 * MAX_WALK_SPEED;

/** osm / google = the map searches; added = places/extra.json, shops the searches miss. */
export type PlaceSource = 'osm' | 'google' | 'added';

export interface RawPlace {
  source: PlaceSource;
  name: string;
  lat: number;
  lng: number;
  /** Street address as the source gives it ("ביאליק 26"), may be empty. */
  address: string;
  /** Category as the source gives it ("supermarket", "חנות מכולת"). */
  category: string;
  /** Source id: OSM "N123"/"W123", Google the place name+coords. */
  ref: string;
}

export interface Place {
  /** Stable id for decisions: first source's ref. */
  id: string;
  name: string;
  names: string[];
  lat: number;
  lng: number;
  address: string;
  categories: string[];
  sources: PlaceSource[];
  refs: string[];
  distanceM: number;
}

/** Ray casting over a GeoJSON ring ([lng, lat] pairs). */
export function inRing(p: { lat: number; lng: number }, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Bounding box [west, south, east, north] of a circle. */
export function circleBox(c: { lat: number; lng: number }, radiusM: number): [number, number, number, number] {
  const dLat = (radiusM / EARTH_M) * (180 / Math.PI);
  const dLng = dLat / Math.cos(rad(c.lat));
  return [c.lng - dLng, c.lat - dLat, c.lng + dLng, c.lat + dLat];
}

export function ringBox(ring: [number, number][]): [number, number, number, number] {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Lower-case, drop punctuation, niqqud-free spacing; for fuzzy name/street compares. */
export function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    // Geresh/gershayim are spelling, not separators: ז'בוטינסקי = זבוטינסקי, ר"ג = רג.
    .replace(/["'`׳״]/g, '')
    .replace(/[.,()|\-–/\\:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC = new Set(['סופר', 'סופרמרקט', 'מרקט', 'מינימרקט', 'מכולת', 'market', 'super', 'supermarket', 'minimarket', 'באר', 'שבע', 'סניף', 'the']);

function nameTokens(s: string): Set<string> {
  return new Set(normText(s).split(' ').filter((t) => t.length > 1 && !GENERIC.has(t)));
}

/** Street part of an address: "חיים נחמן ביאליק 24" → "חיים נחמן ביאליק". */
export function streetOf(address: string): string {
  // Google writes corners as "הרצל פינת, דרך שלמה 91": the street is the part before "פינת".
  const first = normText(address.split(',')[0] ?? '')
    .replace(/^(רחוב|רח|שדרות|שד)\s+/, '')
    .replace(/\s+פינת(\s.*)?$/, '');
  return first.replace(/(^|\s+)(\d+[א-ת]?\s*)+$/, '').trim(); // "10-16" is "10 16" after normText
}

export function similarNames(a: string, b: string): boolean {
  const na = normText(a);
  const nb = normText(b);
  if (na === nb || (na.length > 3 && nb.includes(na)) || (nb.length > 3 && na.includes(nb))) return true;
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.size || !tb.size) return false;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size) >= 0.5;
}

/** Same shop if close and similarly named, or nearly on top of each other with the same street. */
export function samePlace(a: RawPlace | Place, b: RawPlace | Place): boolean {
  const d = distanceM(a, b);
  if (d <= 80 && similarNames(a.name, b.name)) return true;
  if (d <= 15 && a.address && b.address && streetOf(a.address) === streetOf(b.address)) return true;
  return false;
}

export function mergePlaces(raw: RawPlace[], centre: { lat: number; lng: number }): Place[] {
  const out: Place[] = [];
  // Google first: its names and addresses are the ones people search for.
  const ordered = [...raw].sort((a, b) => (a.source === b.source ? 0 : a.source === 'google' ? -1 : 1));
  for (const r of ordered) {
    const hit = out.find((p) => samePlace(p, r));
    if (hit) {
      if (!hit.names.includes(r.name)) hit.names.push(r.name);
      if (!hit.sources.includes(r.source)) hit.sources.push(r.source);
      if (!hit.refs.includes(r.ref)) hit.refs.push(r.ref);
      if (r.category && !hit.categories.includes(r.category)) hit.categories.push(r.category);
      if (!hit.address && r.address) hit.address = r.address;
      continue;
    }
    out.push({
      id: r.ref,
      name: r.name,
      names: [r.name],
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      categories: r.category ? [r.category] : [],
      sources: [r.source],
      refs: [r.ref],
      distanceM: Math.round(distanceM(centre, r)),
    });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

// ---- which retailer is it? ----------------------------------------------

export interface Brand {
  /** Retailer as listed by the regulator (gov.il cpfta_prices_regulations). */
  retailer: string;
  /** chains.ts slug when we already ingest it. */
  chainSlug?: string;
  pattern: RegExp;
}

/**
 * Store-name patterns of retailers that publish price files. Order matters:
 * the first match wins, so sub-brands come before the generic chain name.
 */
export const BRANDS: Brand[] = [
  { retailer: 'שופרסל', chainSlug: 'shufersal', pattern: /שופרסל|shufersal|יש חסד|יש בשכונה/i },
  { retailer: 'רמי לוי', chainSlug: 'rami-levy', pattern: /רמי לוי|rami levy/i },
  { retailer: 'יוחננוף', chainSlug: 'yohananof', pattern: /יוחננוף|yochananof/i },
  { retailer: 'טיב טעם', chainSlug: 'tiv-taam', pattern: /טיב טעם|tiv taam/i },
  { retailer: 'דור אלון (AM:PM)', chainSlug: 'dor-alon', pattern: /am\s*:?\s*pm|דור אלון|אלונית/i },
  { retailer: 'פרשמרקט', chainSlug: 'fresh-market', pattern: /פרשמרקט|פרש מרקט|fresh ?market|מחסני להב|סופר יודה|super yuda/i },
  { retailer: 'קשת טעמים', chainSlug: 'keshet', pattern: /קשת טעמים|keshet/i },
  { retailer: 'אושר עד', chainSlug: 'osher-ad', pattern: /אושר עד|osher ad/i },
  { retailer: 'קרפור / יינות ביתן', chainSlug: 'carrefour', pattern: /קרפור|carrefour|יינות ביתן|ביתן|^מגה(\s|$)|מגה בעיר|קוויק/i },
  { retailer: 'ויקטורי', chainSlug: 'victory', pattern: /ויקטורי|victory/i },
  { retailer: 'מחסני השוק', chainSlug: 'mahsani-hashuk', pattern: /מחסני השוק/i },
  { retailer: 'חצי חינם', pattern: /חצי חינם/i },
  { retailer: 'סופר-פארם', chainSlug: 'super-pharm', pattern: /סופר[ -]?פארם|super[- ]?pharm/i },
  { retailer: 'גוד פארם', chainSlug: 'good-pharm', pattern: /גוד פארם|good ?pharm/i },
  { retailer: 'ניו פארם', pattern: /ניו פארם|new ?pharm/i },
  { retailer: 'סופר ספיר', pattern: /סופר ספיר/i },
  { retailer: 'ברקת', chainSlug: 'bareket', pattern: /סופר ברקת/i },
  { retailer: 'קינג סטור', pattern: /קינג סטור|king store/i },
  { retailer: 'סיטי מרקט', chainSlug: 'city-market', pattern: /סיטי מרקט|city market/i },
  { retailer: 'מעיין 2000', pattern: /מעיין 2000/i },
  { retailer: 'זול ובגדול', pattern: /זול ובגדול/i },
  { retailer: 'נתיב החסד', pattern: /נתיב החסד/i },
  { retailer: 'סטופ מרקט', pattern: /סטופ מרקט|stop market/i },
  { retailer: 'שוק העיר', pattern: /שוק העיר/i },
  { retailer: 'וולט מרקט', pattern: /וולט מרקט|wolt market/i },
  { retailer: 'יילו (פז)', pattern: /יילו|yellow/i },
];

export function brandOf(names: string[]): Brand | null {
  for (const b of BRANDS) if (names.some((n) => b.pattern.test(n))) return b;
  return null;
}

export interface OfficialStore {
  chainSlug: string;
  storeId: string;
  name: string;
  address: string;
  cityId: string | null;
}

// ---- keeping the ingest to the pins ----------------------------------------

/** A pin's test: the circle, or the area outline when the pin has one. */
export function pinContains(pin: Pin, ring: [number, number][] | null, p: { lat: number; lng: number }): boolean {
  if (pin.osmArea) return ring ? inRing(p, ring) : false;
  return distanceM(pin, p) <= (pin.radiusM ?? 1500);
}

const CITY_WORDS = ['תל אביב-יפו', 'תל אביב', 'ת"א', 'באר שבע', 'ב"ש', 'רמת גן', 'ר"ג'];

/**
 * The street part of an official store address, cleaned for geocoding:
 * "רח. ביאליק 76" → "ביאליק 76", "אבן גבירול157" → "אבן גבירול 157",
 * "יצחק נפחא 25 מתחם מבנה" → "יצחק נפחא 25", "רמת גן הירדן 29" → "הירדן 29".
 * null when the chain left it blank / "unknown".
 */
export function cleanStoreStreet(address: string): string | null {
  let a = address.replace(/\(.*?\)|\(.*$/g, '').split(',')[0];
  a = a.replace(/^\s*(רח'?\.?|רחוב|שד'?\.?)\s+/, '');
  for (const w of CITY_WORDS) a = a.startsWith(w + ' ') ? a.slice(w.length) : a;
  a = a.replace(/([א-ת])(\d)/g, '$1 $2').replace(/\s+(פינת|פ\.|מתחם|אזור|קומה|שיכון|קניון)(\s.*)?$/, ''); // no \b: it's ASCII-only
  a = a.replace(/\s+/g, ' ').trim();
  return a && !/^(unknown|לא ידוע|0|-)$/i.test(a) && /[א-תa-z]/i.test(a) ? a : null;
}

/**
 * Geocoding queries for an official store, best first: its street with the
 * city, the same without the house number, then — when the address is
 * unusable — the store name, which usually names the street or mall.
 * Free text without commas: Nominatim matches Hebrew better that way.
 */
export function storeGeocodeQueries(store: { name: string; address: string; chainName: string }, cityName: string): string[] {
  const out: string[] = [];
  const street = cleanStoreStreet(store.address);
  if (street) {
    out.push(`${street} ${cityName}`);
    const bare = street.replace(/\s+\d+[א-ת]?$/, '');
    if (bare !== street) out.push(`${bare} ${cityName}`);
  }
  let name = store.name;
  for (const w of [store.chainName, ...CITY_WORDS, 'am-pm', 'ampm', 'Am-pm', 'AMPM', 'שלי', 'דיל', 'אקספרס', 'סניף', 'BE']) {
    name = name.split(w).join(' ');
  }
  name = name.replace(/[-–,.()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (name.length >= 3 && !out.includes(`${name} ${cityName}`)) out.push(`${name} ${cityName}`);
  return out;
}

const houseNumbers = (s: string) => new Set(s.match(/\d+/g) ?? []);

/**
 * The official store a place is, among one chain's stores in the pin's city.
 * A store is a candidate when its address or name mentions the place's street
 * (its last word: "חיים נחמן ביאליק" ~ "ביאליק"). When both sides carry house
 * numbers they must share one — official addresses can list two ("הרצל 91,
 * עובר להרצל 114"), and a chain often has two branches on one long street.
 * Without numbers, only a sole candidate counts.
 */
export function matchOfficial(place: Place, stores: OfficialStore[]): OfficialStore | null {
  const street = streetOf(place.address);
  const last = street.split(' ').filter((w) => w.length > 1).pop();
  if (!last) return null;
  const candidates = stores.filter((s) => normText(`${s.address} ${s.name}`).split(' ').includes(last));
  const num = place.address.match(/\d+/)?.[0];
  if (num) {
    const numbered = candidates.filter((s) => houseNumbers(`${s.address} ${s.name}`).size > 0);
    const exact = numbered.find((s) => houseNumbers(`${s.address} ${s.name}`).has(num));
    if (exact) return exact;
    const unnumbered = candidates.filter((s) => !numbered.includes(s));
    return unnumbered.length === 1 && numbered.length === 0 ? unnumbered[0] : null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}
