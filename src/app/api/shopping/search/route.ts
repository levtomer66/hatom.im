import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { searchProducts } from '@/lib/shopping/service';

// GET ?q=<words or barcode>&city=<city id> — products matching every word,
// best match first, each with one unit's price range in the city and its
// cheapest store (see searchProducts).
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  const city = request.nextUrl.searchParams.get('city') ?? '';
  if (!CITIES.some((c) => c.id === city)) return NextResponse.json({ error: 'Unknown city' }, { status: 400 });
  try {
    return NextResponse.json(await searchProducts(q, city));
  } catch (error) {
    console.error('Error searching shopping items:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
