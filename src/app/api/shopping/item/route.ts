import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { itemPrices } from '@/lib/shopping/service';

// GET ?key=<item key or barcode>&city=<city id> — one unit of one item (1 kg
// when weighted) priced at every store serving the city that sells it,
// promos applied, cheapest first (see itemPrices). 404 when no such item.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;

  const raw = (request.nextUrl.searchParams.get('key') ?? '').slice(0, 60);
  const city = request.nextUrl.searchParams.get('city') ?? '';
  if (!CITIES.some((c) => c.id === city)) return NextResponse.json({ error: 'Unknown city' }, { status: 400 });
  if (!raw.trim()) return NextResponse.json({ error: 'key is required' }, { status: 400 });
  try {
    const res = await itemPrices(raw, city);
    if (!res) return NextResponse.json({ error: 'No such item' }, { status: 404 });
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error reading shopping item:', error);
    return NextResponse.json({ error: 'Item lookup failed' }, { status: 500 });
  }
}
