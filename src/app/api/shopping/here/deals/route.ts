import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { israelLocalNow } from '@/lib/shopping/snapshot';
import { imgByOf, promoDetail, type HereDealsResponse } from '@/lib/shopping/api-types';
import { storeDeals } from '@/lib/shopping/here';
import { getActivePromosAt, getItemsAt, getStoreByKey } from '@/models/ShoppingCatalog';

/** Rows sent; the page shows them 30 at a time. */
const DEALS_MAX = 400;

// GET ?store=<store key> — "אני בסופר", the deals tab's "all
// deals here": every item's best deal at this store now, biggest share saved
// first. The page puts the lists' deals first and drops them from this list.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const storeKey = Number(request.nextUrl.searchParams.get('store'));
  if (!Number.isInteger(storeKey)) return NextResponse.json({ error: 'store is required' }, { status: 400 });

  try {
    const store = await getStoreByKey(storeKey);
    if (!store || store.kind !== 'physical' || store.city === null) {
      return NextResponse.json({ error: 'No such store' }, { status: 404 });
    }
    const now = israelLocalNow();
    const promos = await getActivePromosAt(storeKey, now);
    const docs = await getItemsAt([...new Set(promos.flatMap((p) => p.items))], storeKey);
    const byKey = new Map(docs.map((d) => [d._id, d]));
    const all = storeDeals(storeKey, promos, byKey, now);
    const deals = all.slice(0, DEALS_MAX);
    const used = new Set(deals.map((d) => d.promo));
    const res: HereDealsResponse = {
      now,
      more: all.length > deals.length,
      deals,
      items: Object.fromEntries(deals.map((d) => {
        const it = byKey.get(d.key)!;
        return [d.key, { name: it.n, w: it.w, img: it.img ?? null, imgBy: imgByOf(it), d: it.d ?? null }];
      })),
      promos: Object.fromEntries(promos.filter((p) => used.has(p._id)).map((p) => [p._id, promoDetail(p)])),
    };
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error listing deals at a store:', error);
    return NextResponse.json({ error: 'Failed to list deals' }, { status: 500 });
  }
}
