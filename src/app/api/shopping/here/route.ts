import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { priceStore, type PricedItem, type PricingOptions } from '@/lib/shopping/pricing';
import type { PromoDoc } from '@/lib/shopping/snapshot';
import { israelLocalNow } from '@/lib/shopping/snapshot';
import { idleDeals, imgByOf, promoDetails, storeInfo, type HereResponse, type HereRow, type ItemPrice, type StoreInfo } from '@/lib/shopping/api-types';
import { mergeLists, verdict } from '@/lib/shopping/here';
import { withManualPrices } from '@/lib/shopping/manual';
import { getItems, getPromosFor, getStoresFor } from '@/models/ShoppingCatalog';
import { getManualPrices } from '@/models/ShoppingManualPrice';
import { getShoppingLists } from '@/models/ShoppingList';
import { getRecentTicked } from '@/models/ShoppingTrip';

/** Past-trip items looked at for "קנית בעבר", and how many of them are shown. */
const BEFORE_SCAN = 300;
const BEFORE_SHOWN = 30;

// GET ?store=<store key>&city=<city id> — "אני בחנות": every item on the
// caller's lists (all of them) priced here and at the city's other physical
// stores, one unit each (1 kg when weighted), deals applied as in the product
// view, grouped by here.ts' verdict. Plus the items bought on recent trips
// that are on a deal here now. Read-only: nothing here changes a list.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const city = request.nextUrl.searchParams.get('city') ?? '';
  const storeKey = Number(request.nextUrl.searchParams.get('store'));
  if (!CITIES.some((c) => c.id === city)) return NextResponse.json({ error: 'Unknown city' }, { status: 400 });
  if (!Number.isInteger(storeKey)) return NextResponse.json({ error: 'store is required' }, { status: 400 });

  try {
    const [stores, lists] = await Promise.all([getStoresFor(city), getShoppingLists(caller.userEmail)]);
    const physical = stores.filter((s) => s.kind === 'physical' && s.city === city);
    const store = physical.find((s) => s.k === storeKey);
    if (!store) return NextResponse.json({ error: 'No such store in this city' }, { status: 404 });

    const lines = mergeLists(lists);
    const listKeys = new Set(lines.map((l) => l.key));
    const before = (await getRecentTicked(lists.map((l) => l.id))).filter((k) => !listKeys.has(k)).slice(0, BEFORE_SCAN);
    const keys = [...listKeys, ...before];
    const [docs, promos] = await Promise.all([getItems(keys), getPromosFor(keys)]);
    const manualKeys = physical.filter((s) => s.source === 'manual').map((s) => s.k);
    const typed = await getManualPrices(manualKeys, keys);
    const items = withManualPrices(new Map(docs.map((d) => [d._id, d])), typed);

    const now = israelLocalNow();
    const opts: PricingOptions = { now };
    const promosOf = new Map<string, PromoDoc[]>();
    for (const p of promos) for (const k of p.items) if (keys.includes(k)) promosOf.set(k, [...(promosOf.get(k) ?? []), p]);

    /** One unit of `key` at `k`, or null when the store doesn't sell it. */
    const unitAt = (k: number, key: string, item: PricedItem): ItemPrice | null => {
      if (item.p[String(k)] === undefined) return null;
      const own = promosOf.get(key) ?? [];
      const b = priceStore(k, [{ key, qty: 1 }], items, own, opts);
      const l = b.lines[0];
      if (!l?.available) return null;
      return { store: k, idle: idleDeals(own, k, key, now, l), regularUnit: l.regularUnit, cost: l.cost, applied: l.applied, offers: l.offers };
    };

    const named = new Set<number>([storeKey]);
    const rows: HereRow[] = lines.map(({ key, qty, listIds }) => {
      const item = items.get(key);
      if (!item) return { key, qty, listIds, here: null, best: null, group: 'missing', saving: 0 };
      const here = unitAt(storeKey, key, item);
      let best: ItemPrice | null = null;
      for (const s of physical) {
        const p = s.k === storeKey ? here : unitAt(s.k, key, item);
        if (p && (!best || p.cost < best.cost || (p.cost === best.cost && p.store === storeKey))) best = p;
      }
      if (best) named.add(best.store);
      const v = verdict(here?.cost ?? null, best?.cost ?? null, qty);
      return { key, qty, listIds, here, best, ...v };
    });

    const deals = before
      .flatMap((key) => {
        const item = items.get(key);
        const here = item ? unitAt(storeKey, key, item) : null;
        return here && here.cost < here.regularUnit ? [{ key, here }] : [];
      })
      .sort((a, b) => (b.here.regularUnit - b.here.cost) - (a.here.regularUnit - a.here.cost))
      .slice(0, BEFORE_SHOWN);

    const shown = new Set([...rows.map((r) => r.key), ...deals.map((d) => d.key)]);
    const res: HereResponse = {
      now,
      city,
      store: storeInfo(store),
      stores: Object.fromEntries(physical.filter((s) => named.has(s.k)).map((s): [number, StoreInfo] => [s.k, storeInfo(s)])),
      items: Object.fromEntries(docs.filter((d) => shown.has(d._id)).map((d) => [d._id, {
        name: d.n, manufacturer: d.m, w: d.w, img: d.img ?? null, imgBy: imgByOf(d), d: d.d ?? null,
      }])),
      lists: lists.map((l) => ({ id: l.id, name: l.name })),
      rows,
      before: deals,
      promos: promoDetails(promos, [
        ...rows.flatMap((r) => [r.here, r.best].filter((p): p is ItemPrice => !!p)),
        ...deals.map((d) => d.here),
      ]),
    };
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error pricing lists at a store:', error);
    return NextResponse.json({ error: 'Failed to price the lists here' }, { status: 500 });
  }
}
