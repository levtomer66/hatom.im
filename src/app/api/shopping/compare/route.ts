import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { ITEM_OPTIONS_SHOWN, RESULTS_PER_SECTION, SPLITS_SHOWN } from '@/lib/shopping/config';
import { MAX_LIST_ITEMS, MAX_QTY } from '@/lib/shopping/lists';
import { bestSplits, priceStore, rankStores, type BasketLine, type PricedItem, type PricingOptions, type StoreBasket } from '@/lib/shopping/pricing';
import { choosePlan, splitPays } from '@/lib/shopping/plans';
import type { PromoDoc } from '@/lib/shopping/snapshot';
import { israelLocalNow } from '@/lib/shopping/snapshot';
import { idleDeals, promoDetails, storeInfo, type Plans, type ShoppingPlan, type CompareResponse, type ItemBest, type StoreInfo } from '@/lib/shopping/api-types';
import { withManualPrices } from '@/lib/shopping/manual';
import { getItems, getPromosFor, getStoresFor } from '@/models/ShoppingCatalog';
import { getManualPrices } from '@/models/ShoppingManualPrice';

/** Each line's cheapest stores, read off the full ranking (every physical store). */
function perItem(lines: BasketLine[], baskets: StoreBasket[]): ItemBest[] {
  return lines.map(({ key, qty }) => {
    const options = baskets
      .flatMap((b) => b.lines.filter((l) => l.key === key && l.available).map((l) => ({
        store: b.store, cost: l.cost, regularCost: l.regularCost, effectiveUnit: l.effectiveUnit,
      })))
      .sort((a, b) => a.cost - b.cost);
    return { key, qty, options: options.slice(0, ITEM_OPTIONS_SHOWN), stores: options.length };
  });
}

/**
 * The one-store plan (the ranking's first) and the cheapest plan over at most
 * three stores, each stop re-priced on its own items.
 */
function buildPlans(
  physical: StoreBasket[],
  lines: BasketLine[],
  items: Map<string, PricedItem>,
  promos: PromoDoc[],
  opts: PricingOptions,
): Plans {
  const first = physical[0];
  const oneStore: ShoppingPlan | null = first
    ? { kind: 'one-store', stops: [{ store: first.store, basket: first }], total: first.total, missing: first.missing }
    : null;
  const choice = choosePlan(physical, lines.map((l) => l.key));
  let cheapest: ShoppingPlan | null = null;
  if (choice && choice.stores.length > 1) {
    const stops = choice.stores.map((store) => ({
      store,
      basket: priceStore(store, lines.filter((l) => choice.assign[l.key] === store), items, promos, opts),
    }));
    cheapest = { kind: 'cheapest', stops, total: stops.reduce((s, x) => s + x.basket.total, 0), missing: choice.missing };
  }
  const saving = oneStore && cheapest ? oneStore.total - cheapest.total : 0;
  const pays = !!oneStore && !!cheapest && (
    cheapest.missing.length < oneStore.missing.length
    || (cheapest.missing.length === oneStore.missing.length && splitPays(cheapest.total, oneStore.total))
  );
  return { oneStore, cheapest, saving, splitPays: pays };
}

function parseBody(body: unknown): { city: string; lines: BasketLine[]; clubs: boolean; coupons: boolean } | string {
  if (!body || typeof body !== 'object') return 'body must be an object';
  const b = body as Record<string, unknown>;
  if (typeof b.city !== 'string' || !CITIES.some((c) => c.id === b.city)) return 'unknown city';
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > MAX_LIST_ITEMS) return 'lines must be a non-empty array';
  const lines: BasketLine[] = [];
  for (const l of b.lines as Record<string, unknown>[]) {
    if (typeof l?.key !== 'string' || l.key.length > 60) return 'bad line key';
    if (typeof l.qty !== 'number' || !(l.qty > 0) || l.qty > MAX_QTY) return `bad quantity for ${l.key}`;
    lines.push({ key: l.key, qty: l.qty });
  }
  return { city: b.city, lines, clubs: b.clubs === true, coupons: b.coupons === true };
}

// POST { city, lines, clubs?, coupons? } — the basket priced at every store
// serving the city: physical stores and online stores ranked separately,
// plus the best two-store splits among the physical ones, and each line's cheapest stores. Manual stores
// (prices typed by users) are always returned in `manual`, with what is
// still unpriced in `missing`; once one prices every line it also competes
// in `physical` and the splits.
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const req = parseBody(body);
  if (typeof req === 'string') return NextResponse.json({ error: req }, { status: 400 });

  try {
    const keys = [...new Set(req.lines.map((l) => l.key))];
    const [stores, itemDocs, promos] = await Promise.all([getStoresFor(req.city), getItems(keys), getPromosFor(keys)]);
    const manualKeys = stores.filter((s) => s.source === 'manual').map((s) => s.k);
    const typed = await getManualPrices(manualKeys, keys);
    const items = withManualPrices(new Map(itemDocs.map((d) => [d._id, d])), typed);
    const now = israelLocalNow();
    const opts: PricingOptions = {
      now,
      clubs: req.clubs ? [...new Set(promos.map((p) => p.club).filter((c) => c !== 0))] : [],
      coupons: req.coupons,
    };
    const manual = rankStores(manualKeys, req.lines, items, promos, opts);
    const complete = new Set(manual.filter((b) => !b.missing.length).map((b) => b.store));
    const physicalKeys = stores
      .filter((s) => s.kind === 'physical' && (s.source !== 'manual' || complete.has(s.k)))
      .map((s) => s.k);
    const onlineKeys = stores.filter((s) => s.kind === 'online').map((s) => s.k);
    // A store that sells nothing on the list isn't an option (a small Wolt shop, say).
    const sellsAny = (b: StoreBasket) => b.missing.length < b.lines.length;
    const physical = rankStores(physicalKeys, req.lines, items, promos, opts).filter(sellsAny);
    const online = rankStores(onlineKeys, req.lines, items, promos, opts).filter(sellsAny);
    const splits = bestSplits(physical, req.lines, items, promos, opts, SPLITS_SHOWN);

    const plans = buildPlans(physical, req.lines, items, promos, opts);

    // Deals a shown line doesn't use yet (a "3 ב־100" with one pack in the list).
    const shownBaskets = [
      ...physical.slice(0, RESULTS_PER_SECTION), ...online.slice(0, RESULTS_PER_SECTION), ...manual,
      ...splits.flatMap((s) => s.stores),
      ...(plans.cheapest?.stops.map((s) => s.basket) ?? []),
    ];
    const shownLines = shownBaskets.flatMap((b) => b.lines);
    const idle: Record<string, string[]> = {};
    for (const b of shownBaskets) {
      for (const l of b.lines) {
        if (!l.available) continue;
        const ids = idleDeals(promos, b.store, l.key, now, l);
        if (ids.length) idle[`${b.store}|${l.key}`] = ids;
      }
    }

    const res: CompareResponse = {
      now,
      city: req.city,
      stores: Object.fromEntries(stores.map((s): [number, StoreInfo] => [s.k, storeInfo(s)])),
      items: Object.fromEntries(itemDocs.map((d) => [d._id, { name: d.n, manufacturer: d.m, w: d.w, img: d.img ?? null, d: d.d ?? null }])),
      physical: physical.slice(0, RESULTS_PER_SECTION),
      online: online.slice(0, RESULTS_PER_SECTION),
      manual,
      splits,
      perItem: perItem(req.lines, physical),
      plans,
      promos: promoDetails(promos, [...shownLines, ...Object.values(idle).map((ids) => ({ applied: [], offers: [], idle: ids }))]),
      idle,
    };
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error comparing shopping basket:', error);
    return NextResponse.json({ error: 'Compare failed' }, { status: 500 });
  }
}
