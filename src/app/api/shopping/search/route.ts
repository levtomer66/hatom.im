import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { nearFor } from '@/lib/shopping/near-server';
import { searchProducts } from '@/lib/shopping/service';

// GET ?q=<words or barcode>&lat&lng&r — products matching every word, best
// match first, each with one unit's price range in the near stores (within r
// km of lat/lng, else of the household's home spot, plus ★ and online) and its
// cheapest store (see searchProducts). An old client's `city` is ignored.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().slice(0, 80);
  try {
    const near = await nearFor(caller.userEmail, { lat: sp.get('lat'), lng: sp.get('lng'), r: sp.get('r') });
    if (typeof near === 'string') return NextResponse.json({ error: near }, { status: 400 });
    return NextResponse.json(await searchProducts(q, near));
  } catch (error) {
    console.error('Error searching shopping items:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
