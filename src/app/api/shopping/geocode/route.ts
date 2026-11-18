import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { geocodeQuery, nominatimUrl, parseGeocode, type Place } from '@/lib/shopping/geocode';

// GET ?q=<address> — up to 5 places in Israel for setting a location by hand
// ({ places: [{ label, lat, lng }] }). Asks OpenStreetMap Nominatim on our
// side, so the browser never calls a third party: only the typed text goes
// out, with the app's name and no user identity. Nominatim's policy allows
// one request a second; answers are cached in memory.

const CACHE_MAX = 200;
const cache = new Map<string, Place[]>();
let lastCallAt = 0;
const UA = 'hatom.im-shopping/1.0 (+https://www.hatom.im)';

export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const q = geocodeQuery(request.nextUrl.searchParams.get('q'));
  if (!q) return NextResponse.json({ error: 'q must be 2..120 characters' }, { status: 400 });
  const hit = cache.get(q);
  if (hit) return NextResponse.json({ places: hit });
  try {
    const wait = lastCallAt + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    const res = await fetch(nominatimUrl(q), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000), cache: 'no-store' });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const places = parseGeocode(await res.json());
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(q, places);
    return NextResponse.json({ places });
  } catch (error) {
    console.error('Error geocoding an address:', error);
    return NextResponse.json({ error: 'Address search failed' }, { status: 502 });
  }
}
