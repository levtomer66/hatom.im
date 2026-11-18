// The shopping queries the page's API routes and the MCP tools share: search,
// one item's prices and a basket comparison. Each takes already-validated
// input (a known city, sane keys and quantities); the routes and tools do
// the validating and the HTTP / text around it. Server-only (reads Mongo).

import { ITEM_OPTIONS_SHOWN, RESULTS_PER_SECTION } from '@/lib/shopping/config';
import { MAX_LIST_ITEMS, MAX_QTY } from '@/lib/shopping/home';
import { priceStore, rankStores, shownUnit, unitAcross, type BasketLine, type PricedItem, type PricingOptions, type StoreBasket } from '@/lib/shopping/pricing';
import { choosePlan, MAX_PLAN_STORES, worthCount } from '@/lib/shopping/plans';
import type { ItemDoc, PromoDoc, StoreDoc } from '@/lib/shopping/snapshot';
import { israelLocalNow } from '@/lib/shopping/snapshot';
import {
  idleDeals, imgByOf, promoDetails, storeInfo,
  type CompareResponse, type FarResponse, type ItemBest, type StoreCardData, type ItemPrice, type ItemResponse, type Plans, type SearchHit, type ShoppingPlan, type StoreInfo,
} from '@/lib/shopping/api-types';
import { priceSourceOf } from '@/lib/shopping/collections';
import { rankHits, searchPatterns } from '@/lib/shopping/search-rank';
import { withManualPrices } from '@/lib/shopping/manual';
import { isLiquid, nutritionOf, packGrams } from '@/lib/shopping/nutrition';
import { findItems, getItems, getPromosFor, getStoresFor, searchItemsAtlas } from '@/models/ShoppingCatalog';
import { getManualPrices } from '@/models/ShoppingManualPrice';

// ── search ───────────────────────────────────────────────────────────────

/**
 * Regex path only (no Atlas Search): with no hit at all, try again allowing
 * one wrong or missing letter per word, over names only. The typo patterns
 * scan slowly (seconds on 54k items), so this stays a last resort; on Atlas
 * the fuzzy $search covers typos.
 */
const TYPO_RETRY_BELOW = 1;
export const MAX_HITS = 30;

/**
 * Items whose name or maker matches every word, spelling-tolerant (see
 * searchPatterns), best name match first (rankHits), then the most widely
 * sold, with one unit's price range in the city and its cheapest store —
 * deals and hand-typed prices included, as the product view prices it.
 * `q`: words or a barcode, trimmed to 80 characters by the caller.
 */
export async function searchProducts(q: string, city: string): Promise<SearchHit[]> {
  const barcode = /^\d{8,14}$/.test(q) ? q : null;
  const terms = searchPatterns(q);
  let loose: string[] | undefined;
  if (!barcode && (!terms.length || q.length < 2)) return [];

  // Atlas Search first (fuzzy, so no retry pass); the regex search where
  // there is no Atlas Search (Docker) or for a barcode.
  const [atlas, stores] = await Promise.all([barcode ? null : searchItemsAtlas(q), getStoresFor(city)]);
  const found = atlas ?? (await findItems(terms, barcode));
  let docs = found;
  if (atlas) loose = searchPatterns(q, { typos: true }); // rank Atlas's fuzzy matches like typo matches
  if (!atlas && !barcode && docs.length < TYPO_RETRY_BELOW) {
    loose = searchPatterns(q, { typos: true });
    const more = await findItems(loose, null, { namesOnly: true });
    const seen = new Set(docs.map((d) => d._id));
    docs = [...docs, ...more.filter((d) => !seen.has(d._id))];
  }
  const local = stores.filter((s) => s.kind === 'physical').map((s) => ({
    k: String(s.k), src: s.source ?? priceSourceOf(s.chainId), chainName: s.chainName, name: s.name,
  }));
  const hits: (SearchHit & { aka?: string })[] = docs.map((d) => {
    const selling = local.filter((s) => d.p[s.k] !== undefined);
    const prices = selling.map((s) => d.p[s.k]);
    const sources = [...new Set(selling.map((s) => s.src))];
    const low = selling.reduce<(typeof selling)[number] | null>((b, s) => (!b || d.p[s.k] < d.p[b.k] ? s : b), null);
    return {
      key: d._id,
      name: d.n,
      manufacturer: d.m,
      w: d.w,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      stores: prices.length,
      sources,
      cheapest: low ? { chainName: low.chainName, name: low.name } : null,
      onSale: false,
      img: d.img ?? null,
      imgBy: imgByOf(d),
      // Ranking only, not sent: other chains' names and makers.
      aka: (d as { s?: string }).s,
    };
  });
  const ranked: SearchHit[] = rankHits(hits, terms, loose).slice(0, MAX_HITS).map((h) => {
    const { aka, ...hit } = h;
    void aka; // ranking only
    return hit;
  });

  // The shown hits re-priced for one unit with deals and typed prices, so
  // "הכי זול ב…" names the store the product view puts first.
  const keys = ranked.map((h) => h.key);
  const manualKeys = stores.filter((s) => s.source === 'manual').map((s) => s.k);
  const [promos, typed] = await Promise.all([getPromosFor(keys), getManualPrices(manualKeys, keys)]);
  const shown = new Set(keys);
  const items = withManualPrices(new Map(docs.filter((d) => shown.has(d._id)).map((d): [string, PricedItem] => [d._id, d])), typed);
  const byK = new Map(stores.map((s) => [s.k, s]));
  const physical = stores.filter((s) => s.kind === 'physical').map((s) => s.k);
  const opts = { now: israelLocalNow() };
  for (const h of ranked) {
    const u = unitAcross(physical, h.key, items, promos, opts);
    if (!u) continue;
    const st = byK.get(u.store)!;
    Object.assign(h, {
      minPrice: u.min, maxPrice: u.max, stores: u.stores, onSale: u.onSale, multi: u.multi,
      cheapest: { chainName: st.chainName, name: st.name },
    });
  }
  return ranked;
}

// ── one item ─────────────────────────────────────────────────────────────

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

/**
 * One unit of one item (1 kg when weighted) priced at every store serving
 * the city that sells it, promos applied, cheapest first. Manual shops count
 * where it's priced. null when there's no such item.
 */
export async function itemPrices(raw: string, city: string): Promise<ItemResponse | null> {
  const tries = candidates(raw);
  const found = await getItems(tries);
  const doc = tries.map((k) => found.find((d) => d._id === k)).find(Boolean);
  if (!doc) return null;
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

  return {
    now,
    city,
    item: {
      key, name: doc.n, manufacturer: doc.m, w: doc.w, img: doc.img ?? null, imgBy: imgByOf(doc), barcode: doc.bc,
      nu: nutritionOf(doc), pack: packGrams(doc.q, doc.uq), liquid: isLiquid(doc.uq, doc.d), d: doc.d ?? null,
    },
    stores: Object.fromEntries(stores.filter((s) => used.has(s.k)).map((s): [number, StoreInfo] => [s.k, storeInfo(s)])),
    physical,
    online,
    promos: promoDetails(promos, [...physical, ...online]),
  };
}

// ── a basket ─────────────────────────────────────────────────────────────

export interface CompareRequest {
  city: string;
  lines: BasketLine[];
  clubs: boolean;
  coupons: boolean;
}

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
 * The one-store plan (the ranking's first) and the cheapest plan over exactly
 * two and three stores, each stop re-priced on its own items. A count that
 * adds no store over the one below it is left out.
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
  const keys = lines.map((l) => l.key);
  const byCount: Plans['byCount'] = {};
  for (let k = 2; k <= MAX_PLAN_STORES; k++) {
    const choice = choosePlan(physical, keys, k);
    if (!choice || choice.stores.length !== k) continue;
    const stops = choice.stores.map((store) => ({
      store,
      basket: priceStore(store, lines.filter((l) => choice.assign[l.key] === store), items, promos, opts),
    }));
    byCount[k] = { kind: 'cheapest', stops, total: stops.reduce((s, x) => s + x.basket.total, 0), missing: choice.missing };
  }
  const counts = Object.keys(byCount).map(Number).sort((a, b) => a - b);
  const worth = oneStore
    ? worthCount([
      { count: 1, total: oneStore.total, missing: oneStore.missing.length },
      ...counts.map((k) => ({ count: k, total: byCount[k]!.total, missing: byCount[k]!.missing.length })),
    ])
    : 1;
  const cheapest = (worth > 1 ? byCount[worth] : byCount[counts[0]]) ?? null;
  const saving = oneStore && cheapest ? oneStore.total - cheapest.total : 0;
  return { oneStore, cheapest, saving, splitPays: worth > 1, byCount, worth };
}

/**
 * The basket priced at every store serving the city: physical and online
 * stores ranked separately, the plans among the physical ones, and each line's cheapest stores. Manual stores (prices typed by
 * users) are always in `manual`, with what's unpriced in `missing`; one that
 * prices every line also competes in `physical` and the plans.
 */
/**
 * A basket request's lines and toggles, validated: shared by POST /compare
 * (which also needs a known city) and POST /far. A string is the error.
 */
export function parseBasketRequest(body: unknown): Omit<CompareRequest, 'city'> & { city: unknown } | string {
  if (!body || typeof body !== 'object') return 'body must be an object';
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > MAX_LIST_ITEMS) return 'lines must be a non-empty array';
  const lines: BasketLine[] = [];
  for (const l of b.lines as Record<string, unknown>[]) {
    if (typeof l?.key !== 'string' || l.key.length > 60) return 'bad line key';
    if (typeof l.qty !== 'number' || !(l.qty > 0) || l.qty > MAX_QTY) return `bad quantity for ${l.key}`;
    lines.push({ key: l.key, qty: l.qty });
  }
  return { city: b.city, lines, clubs: b.clubs === true, coupons: b.coupons === true };
}

/** The basket's items (with prices typed at `manualKeys`), their promos and the pricing options. */
async function loadBasket(req: Omit<CompareRequest, 'city'>, manualKeys: number[]) {
  const keys = [...new Set(req.lines.map((l) => l.key))];
  const [itemDocs, promos] = await Promise.all([getItems(keys), getPromosFor(keys)]);
  const typed = await getManualPrices(manualKeys, keys);
  const items = withManualPrices(new Map(itemDocs.map((d) => [d._id, d])), typed);
  const now = israelLocalNow();
  const opts: PricingOptions = {
    now,
    clubs: req.clubs ? [...new Set(promos.map((p) => p.club).filter((c) => c !== 0))] : [],
    coupons: req.coupons,
  };
  return { itemDocs, items, promos, now, opts };
}

/** What a store card needs beyond its basket: the items, the deals the shown baskets don't reach yet, and every named deal's terms. */
function cardData(shown: StoreBasket[], itemDocs: ItemDoc[], promos: PromoDoc[], now: string): Pick<StoreCardData, 'items' | 'promos' | 'idle'> {
  const idle: Record<string, string[]> = {};
  for (const b of shown) {
    for (const l of b.lines) {
      if (!l.available) continue;
      const ids = idleDeals(promos, b.store, l.key, now, l);
      if (ids.length) idle[`${b.store}|${l.key}`] = ids;
    }
  }
  return {
    items: Object.fromEntries(itemDocs.map((d) => [d._id, { name: d.n, manufacturer: d.m, w: d.w, img: d.img ?? null, imgBy: imgByOf(d), d: d.d ?? null }])),
    idle,
    promos: promoDetails(promos, [...shown.flatMap((b) => b.lines), ...Object.values(idle).map((ids) => ({ applied: [], offers: [], idle: ids }))]),
  };
}

/** "כמה יעלה לי ב…": the basket at each of `stores` (the favorites, any city), ranked like the store list. */
export async function priceAtStores(stores: StoreDoc[], req: Omit<CompareRequest, 'city'>): Promise<FarResponse> {
  const { itemDocs, items, promos, now, opts } = await loadBasket(req, stores.filter((s) => s.source === 'manual').map((s) => s.k));
  const baskets = rankStores(stores.map((s) => s.k), req.lines, items, promos, opts);
  return {
    now,
    stores: Object.fromEntries(stores.map((s): [number, StoreInfo] => [s.k, storeInfo(s)])),
    baskets,
    ...cardData(baskets, itemDocs, promos, now),
  };
}

export async function compareBasket(req: CompareRequest): Promise<CompareResponse> {
  const stores = await getStoresFor(req.city);
  const manualKeys = stores.filter((s) => s.source === 'manual').map((s) => s.k);
  const { itemDocs, items, promos, now, opts } = await loadBasket(req, manualKeys);
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

  const plans = buildPlans(physical, req.lines, items, promos, opts);

  // Deals a shown line doesn't use yet (a "3 ב־100" with one pack in the list).
  const shownBaskets = [
    ...physical.slice(0, RESULTS_PER_SECTION), ...online.slice(0, RESULTS_PER_SECTION), ...manual,
    ...Object.values(plans.byCount).flatMap((p) => p?.stops.map((s) => s.basket) ?? []),
  ];
  const card = cardData(shownBaskets, itemDocs, promos, now);

  return {
    now,
    city: req.city,
    stores: Object.fromEntries(stores.map((s): [number, StoreInfo] => [s.k, storeInfo(s)])),
    items: card.items,
    physical: physical.slice(0, RESULTS_PER_SECTION),
    online: online.slice(0, RESULTS_PER_SECTION),
    manual,
    perItem: perItem(req.lines, physical),
    plans,
    promos: card.promos,
    idle: card.idle,
  };
}
