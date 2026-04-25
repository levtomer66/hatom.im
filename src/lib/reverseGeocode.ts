// Best-effort reverse geocoding via OpenStreetMap Nominatim (free, no key).
// Upload traffic on a personal site is well under the 1 req/sec fair-use
// limit. Failures are never fatal — callers treat a null return as "no label".
//
// Terms of use: https://operations.osmfoundation.org/policies/nominatim/
//   - must set a descriptive User-Agent
//   - must not hammer the endpoint
//   - caching is encouraged

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'hatom.im trip journey (https://www.hatom.im)';
const TIMEOUT_MS = 5000;

// Quantising EXIF coords to 4 decimals (~11 m) before geocoding does two
// things at once: it makes nearby photos share a Nominatim hit (and thus a
// label), and it dampens the GPS noise that would otherwise straddle two
// administrative areas / two POI buildings on a tight street.
const COORD_PRECISION = 4;

function roundCoord(n: number): number {
  const factor = 10 ** COORD_PRECISION;
  return Math.round(n * factor) / factor;
}

// Process-lifetime cache. Anything finer (Redis, Mongo) is overkill for the
// volume; this is just to avoid re-asking Nominatim for the same rounded
// point during a single bulk-upload or backfill batch.
const cache = new Map<string, string | null>();

// Pick a label that's stable for nearby points. Strategy:
//   1. Compute a coarse locality (city/town/village/suburb/county/state).
//   2. Compute an "anchor POI" only from `tourism | attraction | historic`
//      — the categories that are actually trip-worthy. We deliberately drop
//      `shop | amenity | building | leisure` from the POI tier because
//      those are the ones that make two photos shot 10 m apart land on
//      "Starbucks" vs "Times Square".
//   3. Combine: "POI, locality" if both, else whichever exists, else fall
//      back to road/neighbourhood/locality, else display_name's head.
function labelFromResponse(data: {
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
}): string | null {
  const addr = data.address ?? {};
  const locality =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.suburb ||
    addr.county ||
    addr.state ||
    null;
  const poi = addr.tourism || addr.attraction || addr.historic || null;

  if (poi && locality) return `${poi}, ${locality}`;
  if (locality) return locality;
  if (poi) return poi;

  // No locality and no trip-worthy POI — fall back to the road/neighbourhood
  // chain, then to display_name's head. Same shape as before so callers that
  // rely on "best effort string" still see one.
  const parts = [
    addr.road,
    addr.neighbourhood || addr.suburb,
    addr.city || addr.town || addr.village,
  ].filter(Boolean) as string[];
  if (parts.length) return parts.join(', ');

  if (data.display_name) {
    return data.display_name.split(',').slice(0, 2).join(', ').trim() || null;
  }
  return null;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const lat = roundCoord(latitude);
  const lng = roundCoord(longitude);
  const cacheKey = `${lat},${lng}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', lat.toFixed(COORD_PRECISION));
  url.searchParams.set('lon', lng.toFixed(COORD_PRECISION));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '14');
  url.searchParams.set('accept-language', 'en');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      cache.set(cacheKey, null);
      return null;
    }
    const data = await res.json();
    const label = labelFromResponse(data);
    cache.set(cacheKey, label);
    return label;
  } catch (err) {
    // Network error, timeout, bad JSON — log but never throw. Don't cache
    // the failure; a transient hiccup shouldn't poison this coord forever.
    console.warn('reverseGeocode failed', { latitude: lat, longitude: lng, err: String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
