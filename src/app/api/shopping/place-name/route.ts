import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseCentre, placeLabel, roundCentre } from '@/lib/shopping/near';

// GET ?lat=&lng= — the place name for "ליד …" under the search: the street and
// neighbourhood at the caller's position, from OpenStreetMap Nominatim
// (reverse, Hebrew). The position is rounded to ~100 m first and each rounded
// spot is looked up once per server instance (Nominatim's fair use: ≤1 req/s,
// cache). { label: null } when the lookup fails — the page says "המיקום שלך".
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'hatom.im shopping (https://www.hatom.im)';
const TIMEOUT_MS = 4000;
const CACHE_MAX = 500;
const cache = new Map<string, string | null>();

export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const p = request.nextUrl.searchParams;
  const at = parseCentre(p.get('lat'), p.get('lng'));
  if (!at || typeof at === 'string') return NextResponse.json({ error: typeof at === 'string' ? at : 'lat and lng are required' }, { status: 400 });
  const c = roundCentre(at);
  const key = `${c.lat},${c.lng}`;
  if (cache.has(key)) return NextResponse.json({ label: cache.get(key) ?? null });

  const url = new URL(NOMINATIM);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(c.lat));
  url.searchParams.set('lon', String(c.lng));
  url.searchParams.set('zoom', '17');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'he');
  let label: string | null = null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) label = placeLabel(((await res.json()) as { address?: Record<string, string> }).address ?? {});
  } catch {
    return NextResponse.json({ label: null }); // not cached: try again next time
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, label);
  return NextResponse.json({ label });
}
