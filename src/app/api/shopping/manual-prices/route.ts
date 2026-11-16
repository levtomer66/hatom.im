import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseManualPrice } from '@/lib/shopping/manual';
import { getItems, getStoreByKey } from '@/models/ShoppingCatalog';
import { clearManualPrice, setManualPrice } from '@/models/ShoppingManualPrice';

// PUT { store, item, price } — set (agorot) or clear (null) the price of a
// catalog item at a manual store (a shop with no published prices). Prices
// are shared by everyone holding `shopping`, like the lists.
export async function PUT(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const input = parseManualPrice(body);
  if (typeof input === 'string') return NextResponse.json({ error: input }, { status: 400 });

  try {
    const [store, items] = await Promise.all([getStoreByKey(input.store), getItems([input.item])]);
    if (!store) return NextResponse.json({ error: 'unknown store' }, { status: 404 });
    if (store.source !== 'manual') {
      return NextResponse.json({ error: 'prices can only be typed for manual stores' }, { status: 409 });
    }
    if (!items.length) return NextResponse.json({ error: 'unknown item' }, { status: 404 });
    if (input.price === null) {
      await clearManualPrice(input.store, input.item);
      return NextResponse.json({ store: input.store, item: input.item, price: null });
    }
    const saved = await setManualPrice(input.store, input.item, input.price, caller.userEmail);
    return NextResponse.json({ store: saved.s, item: saved.i, price: saved.p, by: saved.by, at: saved.at });
  } catch (error) {
    console.error('Error saving manual price:', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
