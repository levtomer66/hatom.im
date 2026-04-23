// Best-effort reverse geocoding via OpenStreetMap Nominatim (free, no key).
// Upload traffic on a personal site is well under the 1 req/sec fair-use
// limit. Failures are never fatal — callers treat a null return as "no label".
//
// Terms of use: https://operations.osmfoundation.org/policies/nominatim/
//   - must set a descriptive User-Agent
//   - must not hammer the endpoint
//   - caching is encouraged, which we do by storing the result on the
//     journey photo itself (one lookup per photo, for life).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'hatom.im trip journey (https://www.hatom.im)';
const TIMEOUT_MS = 5000;

// Pick the most "specific and useful" label from a Nominatim address object.
// Order: a named place (tourism/shop/building) → road → neighbourhood →
// suburb → city → country. Falls back to the display_name head if nothing
// matches, so we almost always return something meaningful.
function labelFromResponse(data: {
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
}): string | null {
  const addr = data.address ?? {};
  const preferred =
    addr.tourism ||
    addr.shop ||
    addr.amenity ||
    addr.building ||
    addr.attraction ||
    addr.leisure ||
    addr.historic ||
    (data.name && data.name.length > 0 ? data.name : null);

  if (preferred) {
    // Anchor the named POI with a locality so "Bellagio" reads as "Bellagio,
    // Las Vegas" and not just "Bellagio".
    const locality = addr.city || addr.town || addr.village || addr.suburb || addr.state;
    return locality ? `${preferred}, ${locality}` : preferred;
  }

  // No named POI — fall back to a human-friendly street/neighbourhood chain.
  const parts = [
    addr.road,
    addr.neighbourhood || addr.suburb,
    addr.city || addr.town || addr.village,
  ].filter(Boolean) as string[];
  if (parts.length) return parts.join(', ');

  // Last resort: the first two comma-separated pieces of display_name.
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

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', latitude.toFixed(6));
  url.searchParams.set('lon', longitude.toFixed(6));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18');
  url.searchParams.set('accept-language', 'en');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return labelFromResponse(data);
  } catch (err) {
    // Network error, timeout, bad JSON — log but never throw.
    console.warn('reverseGeocode failed', { latitude, longitude, err: String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
