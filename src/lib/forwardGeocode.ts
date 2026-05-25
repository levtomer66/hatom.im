// Best-effort forward geocoding via OpenStreetMap Nominatim. Mirrors
// src/lib/reverseGeocode.ts in spirit — free, no key, well under the
// 1 req/sec fair-use limit for this site's traffic. Failures are never
// fatal: callers treat null as "we couldn't resolve a location for this
// review, leave it off the map."
//
// Terms of use: https://operations.osmfoundation.org/policies/nominatim/
//   - must set a descriptive User-Agent
//   - must not hammer the endpoint
//   - caching is encouraged, which we do by storing the result on the
//     review document itself (one lookup per review, for life).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'hatom.im coffee reviews (https://www.hatom.im)';
const TIMEOUT_MS = 5000;

export interface ForwardGeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

export async function forwardGeocode(query: string): Promise<ForwardGeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  // Israel-bias: every cafe in this app is in Israel, so constraining
  // the search avoids "E.Z" landing on a strip mall in Oklahoma.
  url.searchParams.set('countrycodes', 'il');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en,he' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const items = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name?: string;
      address?: Record<string, string | undefined>;
    }>;
    if (!Array.isArray(items) || items.length === 0) return null;
    const hit = items[0];
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    // Prefer a tight label (cafe / amenity / road + city) over the full
    // verbose display_name, mirroring reverseGeocode's labelling rules.
    const addr = hit.address ?? {};
    const head =
      addr.amenity ||
      addr.shop ||
      addr.tourism ||
      addr.attraction ||
      addr.building ||
      addr.road ||
      addr.neighbourhood ||
      addr.suburb ||
      undefined;
    const city = addr.city || addr.town || addr.village || addr.municipality;
    const label =
      head && city ? `${head}, ${city}`
        : head ?? city ?? (hit.display_name ?? '').split(',').slice(0, 2).join(',').trim();

    return { latitude: lat, longitude: lon, label };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
