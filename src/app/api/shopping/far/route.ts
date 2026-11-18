import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseBasketRequest, priceAtStores } from '@/lib/shopping/service';
import { getStoresByKeys } from '@/models/ShoppingCatalog';
import { getHome } from '@/models/ShoppingHome';

// POST { lines, clubs?, coupons? } — "כמה יעלה לי ב…": the list priced at
// each of the household's favorite stores, whatever their city (a favorite
// that lost its prices is skipped). Read-only.
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const req = parseBasketRequest(body);
  if (typeof req === 'string') return NextResponse.json({ error: req }, { status: 400 });
  try {
    const stores = await getStoresByKeys((await getHome()).favStores);
    return NextResponse.json(await priceAtStores(stores, req));
  } catch (error) {
    console.error('Error pricing the list at the favorite stores:', error);
    return NextResponse.json({ error: 'Failed to price the favorites' }, { status: 500 });
  }
}
