import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { rankStores, shownUnit, type BasketLine, type PricingOptions, type StoreBasket } from '@/lib/shopping/pricing';
import { israelLocalNow } from '@/lib/shopping/snapshot';
import { idleDeals, imgByOf, promoDetails, storeInfo, type ItemPrice, type ItemResponse, type StoreInfo } from '@/lib/shopping/api-types';
import { withManualPrices } from '@/lib/shopping/manual';
import { getItems, getPromosFor, getStoresFor } from '@/models/ShoppingCatalog';
import { getManualPrices } from '@/models/ShoppingManualPrice';

/**
 * Keys to try for what the user gave us. A scanned barcode may carry leading
 * zeros the price files drop (UPC-A read as EAN-13), so try it bare too.
 */
function candidates(raw: string): string[] {
  const k = raw.trim();
  if (!/^\d{8,14}$/.test(k)) return [k];
  const bare = k.replace(/^0+/, '');
  return [...new Set([k, bare])];
}


// GET ?key=<item key or barcode>&city=<city id> — one unit of one item (1 kg
// when weighted) priced at every store serving the city that sells it,
// promos applied, cheapest first. Manual shops count where it's priced.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;

  const raw = (request.nextUrl.searchParams.get('key') ?? '').slice(0, 60);
  const city = request.nextUrl.searchParams.get('city') ?? '';
  if (!CITIES.some((c) => c.id === city)) return NextResponse.json({ error: 'Unknown city' }, { status: 400 });
  if (!raw.trim()) return NextResponse.json({ error: 'key is required' }, { status: 400 });

  try {
    const tries = candidates(raw);
    const found = await getItems(tries);
    const doc = tries.map((k) => found.find((d) => d._id === k)).find(Boolean);
    if (!doc) return NextResponse.json({ error: 'No such item' }, { status: 404 });
    const key = doc._id;

    const [stores, promos] = await Promise.all([getStoresFor(city), getPromosFor([key])]);
    const manualKeys = stores.filter((s) => s.source === 'manual').map((s) => s.k);
    const typed = await getManualPrices(manualKeys, [key]);
    const items = withManualPrices(new Map([[key, doc]]), typed);
    const now = israelLocalNow();
    const opts: PricingOptions = { now };
    const line: BasketLine[] = [{ key, qty: 1 }];
    const sells = (b: StoreBasket) => !b.missing.length;
    const toPrice = (b: StoreBasket): ItemPrice => {
      const l = b.lines[0];
      return {
        store: b.store, idle: idleDeals(promos, b.store, key, now, l), regularUnit: l.regularUnit,
        applied: l.applied, offers: l.offers, ...shownUnit(b.store, key, items, promos, opts, l.cost),
      };
    };
    // Cheapest per unit first, a multi-buy at its per-unit price.
    const byCost = (a: ItemPrice, b: ItemPrice) => a.cost - b.cost;
    const physical = rankStores(stores.filter((s) => s.kind === 'physical').map((s) => s.k), line, items, promos, opts)
      .filter(sells).map(toPrice).sort(byCost);
    const online = rankStores(stores.filter((s) => s.kind === 'online').map((s) => s.k), line, items, promos, opts)
      .filter(sells).map(toPrice).sort(byCost);
    const used = new Set([...physical, ...online].map((p) => p.store));

    const res: ItemResponse = {
      now,
      city,
      item: { key, name: doc.n, manufacturer: doc.m, w: doc.w, img: doc.img ?? null, imgBy: imgByOf(doc), barcode: doc.bc },
      stores: Object.fromEntries(stores.filter((s) => used.has(s.k)).map((s): [number, StoreInfo] => [s.k, storeInfo(s)])),
      physical,
      online,
      promos: promoDetails(promos, [...physical, ...online]),
    };
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error reading shopping item:', error);
    return NextResponse.json({ error: 'Item lookup failed' }, { status: 500 });
  }
}
