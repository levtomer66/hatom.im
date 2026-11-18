import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { priceStore, shownUnit, type PricedItem, type PricingOptions } from '@/lib/shopping/pricing';
import type { PromoDoc } from '@/lib/shopping/snapshot';
import { israelLocalNow } from '@/lib/shopping/snapshot';
import { idleDeals, imgByOf, promoDetails, storeInfo, type HereResponse, type HereRow, type ItemPrice, type StoreInfo } from '@/lib/shopping/api-types';
import { hereLines, verdict } from '@/lib/shopping/here';
import { withManualPrices } from '@/lib/shopping/manual';
import { getCandidateStores, getItems, getPromosFor, getStoreByKey, storeLoc } from '@/models/ShoppingCatalog';
import { nearStores, parseRadius, type Where } from '@/lib/shopping/near';
import { getManualPrices } from '@/models/ShoppingManualPrice';
import { householdFor } from '@/models/ShoppingHome';
import { getRecentTicked } from '@/models/ShoppingTrip';

/** Past-trip items looked at for "קנית בעבר", and how many of them are shown. */
const BEFORE_SCAN = 300;
const BEFORE_SHOWN = 30;

// GET ?store=<store key>&r=<km> — "אני בסופר": every one of the
// household's My items (the shopping list's first, at the list's quantity)
// priced here and at the physical stores within r km of this one (plus ★), one unit each (1 kg when weighted), deals applied as in the product
// view, grouped by here.ts' verdict. Plus the items bought on recent trips
// that are on a deal here now. Read-only: nothing here changes My items or the list.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const storeKey = Number(request.nextUrl.searchParams.get('store'));
  if (!Number.isInteger(storeKey)) return NextResponse.json({ error: 'store is required' }, { status: 400 });

  try {
    // "Cheaper elsewhere" is measured around the store you're standing in, not around you.
    const picked = await getStoreByKey(storeKey);
    if (!picked || picked.kind !== 'physical') return NextResponse.json({ error: 'No such store' }, { status: 404 });
    const [candidates, home] = await Promise.all([getCandidateStores(), householdFor(caller.userEmail)]);
    const where: Where = { centre: storeLoc(picked), source: 'live', radiusKm: parseRadius(request.nextUrl.searchParams.get('r')) };
    const near = nearStores(candidates.map((s) => ({ ...s, loc: storeLoc(s) })), where, home.favStores).filter((s) => s.kind === 'physical');
    // The store itself always counts, even without a point (it then has no radius around it).
    const physical = near.some((s) => s.k === storeKey) ? near : [{ ...picked, loc: storeLoc(picked), distM: 0 }, ...near];
    const store = physical.find((s) => s.k === storeKey)!;

    const lines = hereLines(home.list, home.items);
    const mine = new Set(lines.map((l) => l.key));
    const before = (await getRecentTicked([home.id])).filter((k) => !mine.has(k)).slice(0, BEFORE_SCAN);
    const keys = [...mine, ...before];
    const wanted = new Set(keys);
    const [docs, promos] = await Promise.all([getItems(keys), getPromosFor(keys)]);
    const manualKeys = physical.filter((s) => s.source === 'manual').map((s) => s.k);
    const typed = await getManualPrices(manualKeys, keys);
    const items = withManualPrices(new Map(docs.map((d) => [d._id, d])), typed);

    const now = israelLocalNow();
    const opts: PricingOptions = { now };
    const promosOf = new Map<string, PromoDoc[]>();
    for (const p of promos) for (const k of p.items) if (wanted.has(k)) promosOf.set(k, [...(promosOf.get(k) ?? []), p]);

    /** One unit of `key` at `k`, or null when the store doesn't sell it. */
    const unitAt = (k: number, key: string, item: PricedItem): ItemPrice | null => {
      if (item.p[String(k)] === undefined) return null;
      const own = promosOf.get(key) ?? [];
      const b = priceStore(k, [{ key, qty: 1 }], items, own, opts);
      const l = b.lines[0];
      if (!l?.available) return null;
      return {
        store: k, idle: idleDeals(own, k, key, now, l), regularUnit: l.regularUnit,
        applied: l.applied, offers: l.offers, ...shownUnit(k, key, items, own, opts, l.cost),
      };
    };

    const named = new Set<number>([storeKey]);
    const rows: HereRow[] = lines.map(({ key, qty, onList }) => {
      const item = items.get(key);
      if (!item) return { key, qty, onList, here: null, best: null, group: 'missing', saving: 0 };
      const here = unitAt(storeKey, key, item);
      let best: ItemPrice | null = null;
      for (const s of physical) {
        const p = s.k === storeKey ? here : unitAt(s.k, key, item);
        if (p && (!best || p.cost < best.cost || (p.cost === best.cost && p.store === storeKey))) best = p;
      }
      if (best) named.add(best.store);
      const v = verdict(here?.cost ?? null, best?.cost ?? null, qty);
      return { key, qty, onList, here, best, ...v };
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
      where,
      store: storeInfo(store),
      stores: Object.fromEntries(physical.filter((s) => named.has(s.k)).map((s): [number, StoreInfo] => [s.k, storeInfo(s)])),
      items: Object.fromEntries(docs.filter((d) => shown.has(d._id)).map((d) => [d._id, {
        name: d.n, manufacturer: d.m, w: d.w, img: d.img ?? null, imgBy: imgByOf(d), d: d.d ?? null,
      }])),
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
