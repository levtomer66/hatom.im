import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { geocodeQuery, parseGeocode, photonUrl, type Place } from '@/lib/shopping/geocode';

// GET ?q=<address> — up to 6 places in Israel for setting a location by hand,
// as you type ({ places: [{ label, lat, lng }] }). Asks Photon (komoot's
// OpenStreetMap geocoder, made for search-as-you-type) on our side, so the
// browser never calls a third party: only the typed text goes out, with the
// app's name, no user identity and no location. The page debounces; answers
// are cached in memory.

const CACHE_MAX = 200;
const cache = new Map<string, Place[]>();
const UA = 'hatom.im-shopping/1.0 (+https://www.hatom.im)';

export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const q = geocodeQuery(request.nextUrl.searchParams.get('q'));
  if (!q) return NextResponse.json({ error: 'q must be 2..120 characters' }, { status: 400 });
  const hit = cache.get(q);
  if (hit) return NextResponse.json({ places: hit });
  try {
    const res = await fetch(photonUrl(q), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000), cache: 'no-store' });
    if (!res.ok) throw new Error(`photon ${res.status}`);
    const places = parseGeocode(await res.json());
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(q, places);
    return NextResponse.json({ places });
  } catch (error) {
    console.error('Error geocoding an address:', error);
    return NextResponse.json({ error: 'Address search failed' }, { status: 502 });
  }
}
