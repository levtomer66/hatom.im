import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { farStores } from '@/lib/shopping/home';
import { parseBasketRequest, priceAtStores } from '@/lib/shopping/service';
import { getStoresByKeys } from '@/models/ShoppingCatalog';

// POST { stores, lines, clubs?, coupons? } — "כמה יעלה לי ב…": the list priced
// at each favorite store (`stores`: the page's current favorites, so a star
// just tapped counts before its save lands), whatever their city; a store
// that lost its prices is skipped. Read-only.
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
  const keys = farStores(body);
  if (!keys.ok) return NextResponse.json({ error: keys.error }, { status: 400 });
  try {
    const stores = await getStoresByKeys(keys.value);
    return NextResponse.json(await priceAtStores(stores, req));
  } catch (error) {
    console.error('Error pricing the list at the favorite stores:', error);
    return NextResponse.json({ error: 'Failed to price the favorites' }, { status: 500 });
  }
}
