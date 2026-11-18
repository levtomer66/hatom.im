// Address search as you type, for setting a location by hand (spec addendum in
// docs/superpowers/specs/2026-11-18-shopping-no-cities-design.md): our
// /api/shopping/geocode asks Photon (komoot's OpenStreetMap geocoder, built
// for search-as-you-type; Nominatim's policy forbids it), inside Israel's
// bounding box, with the typed text only — no location bias, so the user's
// position never goes out. The request URL and reading its answer are here;
// pure and import-free.

export interface Place { label: string; lat: number; lng: number }

/** The typed address, trimmed; null unless 2..120 characters. */
export function geocodeQuery(q: unknown): string | null {
  if (typeof q !== 'string') return null;
  const t = q.trim();
  return t.length >= 2 && t.length <= 120 ? t : null;
}

/** Israel (minLon, minLat, maxLon, maxLat). */
const IL_BBOX = '34.2,29.4,35.95,33.4';
export const MAX_PLACES = 6;

export function photonUrl(q: string): string {
  const u = new URL('https://photon.komoot.io/api/');
  u.search = new URLSearchParams({ q, limit: String(MAX_PLACES), bbox: IL_BBOX }).toString();
  return u.toString();
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');

/** "name, street number, town", each part once (a town named like itself isn't repeated). */
function labelOf(p: Record<string, unknown>): string {
  const street = [str(p.street), str(p.housenumber)].filter(Boolean).join(' ');
  const parts = [str(p.name), street, str(p.city) || str(p.locality) || str(p.district)].filter(Boolean);
  return [...new Set(parts)].join(', ');
}

/** Photon's GeoJSON answer → places in Israel with a usable point and label, each label once. */
export function parseGeocode(json: unknown): Place[] {
  const features = json && typeof json === 'object' ? (json as { features?: unknown }).features : null;
  if (!Array.isArray(features)) return [];
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const props = (f?.properties ?? {}) as Record<string, unknown>;
    const coords = f?.geometry?.coordinates;
    if (props.countrycode !== 'IL' || !Array.isArray(coords)) continue;
    const [lng, lat] = coords;
    const label = labelOf(props);
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || !label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, lat: round4(lat), lng: round4(lng) });
  }
  return out;
}
