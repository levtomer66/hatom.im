import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { nearFor } from '@/lib/shopping/near-server';
import { itemPrices } from '@/lib/shopping/service';

// GET ?key=<item key or barcode>&lat&lng&r — one unit of one item (1 kg when
// weighted) priced at every near store that sells it, promos applied,
// cheapest first (see itemPrices). 404 when no such item.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;

  const sp = request.nextUrl.searchParams;
  const raw = (sp.get('key') ?? '').slice(0, 60);
  if (!raw.trim()) return NextResponse.json({ error: 'key is required' }, { status: 400 });
  try {
    const near = await nearFor(caller.userEmail, { lat: sp.get('lat'), lng: sp.get('lng'), r: sp.get('r') });
    if (typeof near === 'string') return NextResponse.json({ error: near }, { status: 400 });
    const res = await itemPrices(raw, near);
    if (!res) return NextResponse.json({ error: 'No such item' }, { status: 404 });
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error reading shopping item:', error);
    return NextResponse.json({ error: 'Item lookup failed' }, { status: 500 });
  }
}
