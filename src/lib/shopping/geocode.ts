// Address search for setting a location by hand (spec addendum in
// docs/superpowers/specs/2026-11-18-shopping-no-cities-design.md): our
// /api/shopping/geocode asks OpenStreetMap Nominatim, Israel only, in Hebrew.
// The request URL and reading its answer are here; pure and import-free.

export interface Place { label: string; lat: number; lng: number }

/** The typed address, trimmed; null unless 2..120 characters. */
export function geocodeQuery(q: unknown): string | null {
  if (typeof q !== 'string') return null;
  const t = q.trim();
  return t.length >= 2 && t.length <= 120 ? t : null;
}

export function nominatimUrl(q: string): string {
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.search = new URLSearchParams({
    q, format: 'jsonv2', addressdetails: '1', countrycodes: 'il', 'accept-language': 'he', limit: '5',
  }).toString();
  return u.toString();
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');

/** A short label: "street number, town"; else "name, town"; else the display name's first two parts. */
function labelOf(r: Record<string, unknown>): string {
  const a = (r.address && typeof r.address === 'object' ? r.address : {}) as Record<string, unknown>;
  const town = str(a.city) || str(a.town) || str(a.village) || str(a.suburb);
  const road = str(a.road);
  if (road) return [[road, str(a.house_number)].filter(Boolean).join(' '), town].filter(Boolean).join(', ');
  const name = str(r.name);
  if (name) return town && town !== name ? `${name}, ${town}` : name;
  return str(r.display_name).split(',').map((p) => p.trim()).filter(Boolean).slice(0, 2).join(', ');
}

/** Nominatim's jsonv2 answer → places with a usable point and label. */
export function parseGeocode(json: unknown): Place[] {
  if (!Array.isArray(json)) return [];
  const out: Place[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    const label = labelOf(r);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || r.lat === undefined || r.lon === undefined || !label) continue;
    out.push({ label, lat: round4(lat), lng: round4(lng) });
  }
  return out;
}
