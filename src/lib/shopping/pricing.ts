// Basket pricing over the ingested docs: what a shopping list costs at each
// store once its promotions are applied, the cheapest store, and the best
// two-store split. Pure and import-free apart from types, for `node --test`.
//
// How published promo terms are read (measured on Shufersal + Yochananof,
// 2026-11-15; see docs/sources.md § Promo structure):
// - A part's `price` is the total for `min` units ("2ב20" = min 2, price
//   2000). When it is null, the deal is the percent `rate` off regular.
//   A published price wins over the rate, because the till charges the price.
// - Weighted items: `min` is a weight in kg. The sentinel min 0.01 means the
//   price is per kg; otherwise per kg = price / min ("2 ק״ג ב-65" is min 1.9,
//   price 6175). `max` caps the discounted weight ("עד 3 ק״ג").
// - Units of every item in one part pool together (mix & match).
// - "1+1"/"1+3" deals are a buy part plus a gift part (price 0 or rate 100).
//   The buy part's price is informational, and the cheapest units go free.
// - "השני ב-20" / "השני ב-50%" / "השני ב-1₪" are the same shape with a priced
//   reward: parts under a second group id (gid) are the reward, the first
//   gid's parts the buy (each item listed at its own regular price, again
//   informational). One unit alone gets nothing; each pair gets its cheaper
//   unit at the reward's price per unit or percent off. Measured on Good Pharm
//   27675, Super-Pharm and Dor Alon, 2026-11-17.
// - `limit` (RedemptionLimit) caps the number of redemptions per basket.
//
// Not applied by default but listed on the line as an offer: club promos
// (club ≠ 0) unless the club is in `clubs`, coupons unless `coupons`, and
// basket-minimum promos whose minimum the store subtotal doesn't reach.
// Never applied, listed as 'unclear': a plain deal priced below
// MIN_PLAUSIBLE of the shelf price per unit, or below zero. Of ~31k priced
// deals (2026-11-17) 11 were: "מישל מרסייה 2 ב-10" on ₪69.90 serums,
// institutional packs ("מוסדי", min 30), packaging credits, a negative-price
// coupon. Deals at 15–20% looked real ("2 ב-5" clearance), hence 15%.
// Deals that exist only in the description text are not parsed.

import type { PromoDoc, PromoGroupDoc } from './snapshot.ts';

export interface BasketLine {
  key: string;
  /** Units, or kg for weighted items. */
  qty: number;
}

/** The ItemDoc fields pricing needs. */
export interface PricedItem {
  _id: string;
  w: boolean;
  /** Store key → agorot per unit (per kg when weighted). */
  p: Record<string, number>;
}

export interface PricingOptions {
  /** Israel local "YYYY-MM-DDTHH:mm" — promos outside [s, e] don't apply. */
  now: string;
  /** Club ids the shopper belongs to (0, everyone, always applies). */
  clubs?: number[];
  /** Apply coupon promos. Default false. */
  coupons?: boolean;
}

export type OfferReason = 'club' | 'coupon' | 'min-purchase' | 'unclear';

/** A plain deal's price per unit below this share of the shelf price is taken for a data error. */
export const MIN_PLAUSIBLE = 0.15;

export interface PromoRef {
  id: string;
  description: string;
  /** Israel local end, "YYYY-MM-DDTHH:mm". */
  end: string;
}

export interface AppliedPromo extends PromoRef {
  /** Agorot saved on this line by this promo. */
  savings: number;
}

export interface Offer extends PromoRef {
  reason: OfferReason;
  clubName?: string;
}

export interface LineResult {
  key: string;
  qty: number;
  /** False when the store doesn't sell the item; costs are then 0. */
  available: boolean;
  regularUnit: number;
  regularCost: number;
  cost: number;
  /** cost / qty, the effective price per unit (or kg). */
  effectiveUnit: number;
  applied: AppliedPromo[];
  offers: Offer[];
}

export interface StoreBasket {
  store: number;
  total: number;
  regularTotal: number;
  /** Keys the store doesn't sell. */
  missing: string[];
  lines: LineResult[];
}

const EPS = 1e-9;

const isGift = (g: PromoGroupDoc) => g.price === 0 || g.rate === 100;

/** Per-unit (per-kg) promo price for a weighted part, or null if no deal. */
function weightedUnitPrice(g: PromoGroupDoc, regular: number): number | null {
  if (g.price !== null) return g.min <= 0.01 + EPS ? g.price : g.price / g.min;
  if (g.rate !== null && g.rate > 0) return regular * (1 - g.rate / 100);
  return null;
}

/** A reward part's price for one unit of an item whose regular price is `reg`. */
function rewardUnit(g: PromoGroupDoc, reg: number): number {
  if (isGift(g)) return 0;
  if (g.price !== null) return Math.min(reg, g.price / Math.max(1, Math.round(g.min)));
  if (g.rate !== null && g.rate > 0) return reg * (1 - g.rate / 100);
  return reg;
}

/**
 * A buy-and-reward deal's parts: gift parts reward the others; without a
 * gift, the parts under a group id other than the first part's are the
 * reward. Null when the deal is a plain one (one group id, no gift, or
 * nothing to buy).
 */
function buyAndReward(promo: PromoDoc): { buys: PromoGroupDoc[]; rewards: PromoGroupDoc[] } | null {
  const gifts = promo.g.filter(isGift);
  const split = gifts.length
    ? { buys: promo.g.filter((g) => !isGift(g)), rewards: gifts }
    : { buys: promo.g.filter((g) => g.gid === promo.g[0]?.gid), rewards: promo.g.filter((g) => g.gid !== promo.g[0]?.gid) };
  return split.buys.length && split.rewards.length ? split : null;
}

/** Units bought (`a`) and rewarded (`b`) per redemption of a buy-and-reward deal. */
function buyRewardCounts(split: { buys: PromoGroupDoc[]; rewards: PromoGroupDoc[] }): { a: number; b: number } {
  return {
    a: Math.max(1, Math.round(Math.min(...split.buys.map((g) => g.min)))),
    b: Math.max(1, Math.round(Math.min(...split.rewards.map((g) => (g.max !== null ? Math.min(g.min, g.max) : g.min))))),
  };
}

/**
 * Units a deal needs before it saves anything: bought and rewarded units
 * together for buy-and-reward deals ("השני ב-20" → 2, "1+1" → 2), else its
 * first part's minimum. Null for a deal with no parts.
 */
export function dealMinQty(promo: PromoDoc): number | null {
  const split = buyAndReward(promo);
  if (split) {
    const { a, b } = buyRewardCounts(split);
    return a + b;
  }
  return promo.g[0]?.min ?? null;
}

/**
 * Whether a plain deal's price is too low to be real for any basket item
 * (see MIN_PLAUSIBLE). Buy-and-reward deals are exempt: "השני ב-1₪" is real.
 */
function implausible(promo: PromoDoc, regular: Map<string, number>): boolean {
  if (buyAndReward(promo)) return false;
  return promo.g.some((g) => {
    if (g.price === null || isGift(g) || g.w) return false;
    const unit = g.price / Math.max(1, Math.round(g.min));
    return g.items.some((k) => {
      const reg = regular.get(k);
      return reg !== undefined && (unit < 0 || unit < reg * MIN_PLAUSIBLE);
    });
  });
}

interface Evaluation {
  /** Agorot saved per line key. */
  savings: Map<string, number>;
  /** Quantity consumed per line key (so no other promo reuses it). */
  used: Map<string, number>;
  total: number;
}

interface Unit {
  key: string;
  price: number;
}

/** Individual units of the basket lines in `keys`, most expensive first. */
function unitsOf(keys: Iterable<string>, remaining: Map<string, number>, regular: Map<string, number>): Unit[] {
  const out: Unit[] = [];
  for (const key of new Set(keys)) {
    const n = Math.floor((remaining.get(key) ?? 0) + EPS);
    for (let i = 0; i < n; i++) out.push({ key, price: regular.get(key)! });
  }
  return out.sort((a, b) => b.price - a.price);
}

function credit(ev: Evaluation, key: string, saved: number, used: number) {
  ev.savings.set(key, (ev.savings.get(key) ?? 0) + saved);
  ev.used.set(key, (ev.used.get(key) ?? 0) + used);
  ev.total += saved;
}

/** Spread a bundle's savings over its units in proportion to their prices. */
function creditBundle(ev: Evaluation, bundle: Unit[], saved: number) {
  const sum = bundle.reduce((s, u) => s + u.price, 0);
  for (const u of bundle) credit(ev, u.key, sum > 0 ? (saved * u.price) / sum : saved / bundle.length, 1);
}

function evaluate(
  promo: PromoDoc,
  remaining: Map<string, number>,
  regular: Map<string, number>,
  weighted: Set<string>,
): Evaluation {
  const ev: Evaluation = { savings: new Map(), used: new Map(), total: 0 };
  const inBasket = (g: PromoGroupDoc) => g.items.filter((k) => (remaining.get(k) ?? 0) > EPS);
  let redemptions = promo.limit ?? Infinity;

  const split = buyAndReward(promo);
  if (split) {
    // Buy `a`, get `b` free or cheaper; the cheapest units of each redemption get the reward.
    const { buys, rewards } = split;
    const { a, b } = buyRewardCounts(split);
    const buyKeys = new Set(buys.flatMap(inBasket));
    const rewardKeys = new Set(rewards.flatMap(inBasket));
    /** What the reward saves on one unit (its best reward part). */
    const saving = (u: Unit) => Math.max(0, u.price - Math.min(...rewards.filter((g) => g.items.includes(u.key)).map((g) => rewardUnit(g, u.price))));
    const pooled = [...rewardKeys].every((k) => buyKeys.has(k));
    if (pooled) {
      const units = unitsOf(buyKeys, remaining, regular);
      for (let i = 0; i + a + b <= units.length && redemptions > 0; i += a + b, redemptions--) {
        const group = units.slice(i, i + a + b);
        if (!group.slice(a).every((u) => rewardKeys.has(u.key))) break;
        group.forEach((u, n) => credit(ev, u.key, n >= a ? saving(u) : 0, 1));
      }
    } else {
      const buyUnits = unitsOf([...buyKeys].filter((k) => !rewardKeys.has(k)), remaining, regular);
      const rewardUnits = unitsOf(rewardKeys, remaining, regular);
      const r = Math.min(Math.floor(buyUnits.length / a), Math.floor(rewardUnits.length / b), redemptions);
      for (const u of buyUnits.slice(0, r * a)) credit(ev, u.key, 0, 1);
      for (const u of rewardUnits.slice(0, r * b)) credit(ev, u.key, saving(u), 1);
    }
    return ev;
  }

  for (const g of promo.g) {
    const keys = inBasket(g);
    if (!keys.length) continue;
    const byWeight = keys.filter((k) => g.w || weighted.has(k));
    for (const key of byWeight) {
      if (redemptions <= 0) break;
      const q = remaining.get(key)!;
      const reg = regular.get(key)!;
      const unit = weightedUnitPrice(g, reg);
      if (unit === null || q + EPS < g.min || unit >= reg) continue;
      const dq = g.max !== null ? Math.min(q, g.max) : q;
      credit(ev, key, (reg - unit) * dq, q);
      redemptions--;
    }
    const units = unitsOf(keys.filter((k) => !byWeight.includes(k)), remaining, regular);
    const m = Math.max(1, Math.round(g.min));
    for (let i = 0; i + m <= units.length && redemptions > 0; i += m, redemptions--) {
      const bundle = units.slice(i, i + m);
      const reg = bundle.reduce((s, u) => s + u.price, 0);
      const cost = g.price ?? (g.rate !== null && g.rate > 0 ? reg * (1 - g.rate / 100) : reg);
      if (cost >= reg) break; // units are sorted, so later bundles save even less
      creditBundle(ev, bundle, reg - cost);
    }
  }
  return ev;
}

function ref(p: PromoDoc): PromoRef {
  return { id: p._id, description: p.d, end: p.e };
}

/** Price `lines` at one store. `promos` may include other stores' promos. */
export function priceStore(
  store: number,
  lines: BasketLine[],
  items: Map<string, PricedItem>,
  promos: PromoDoc[],
  opts: PricingOptions,
): StoreBasket {
  const sk = String(store);
  const qty = new Map<string, number>();
  for (const l of lines) if (l.qty > 0) qty.set(l.key, (qty.get(l.key) ?? 0) + l.qty);

  const regular = new Map<string, number>();
  const weighted = new Set<string>();
  const missing: string[] = [];
  for (const key of qty.keys()) {
    const it = items.get(key);
    const price = it?.p[sk];
    if (price === undefined) missing.push(key);
    else {
      regular.set(key, price);
      if (it!.w) weighted.add(key);
    }
  }
  const regularCost = new Map([...regular].map(([k, p]) => [k, Math.round(p * qty.get(k)!)]));
  const subtotal = [...regularCost.values()].reduce((a, b) => a + b, 0);

  const offers = new Map<string, Offer[]>();
  const eligible: PromoDoc[] = [];
  const clubs = new Set(opts.clubs ?? []);
  for (const p of promos) {
    if (!p.stores.includes(store) || p.s > opts.now || p.e < opts.now) continue;
    if (!p.items.some((k) => regular.has(k))) continue;
    let reason: OfferReason | null = null;
    if (p.club !== 0 && !clubs.has(p.club)) reason = 'club';
    else if (p.coupon && !opts.coupons) reason = 'coupon';
    else if (p.minAmt !== null && subtotal < p.minAmt) reason = 'min-purchase';
    else if (implausible(p, regular)) reason = 'unclear';
    if (!reason) {
      eligible.push(p);
      continue;
    }
    const offer: Offer = { ...ref(p), reason, ...(reason === 'club' ? { clubName: p.clubName } : {}) };
    for (const k of p.items) if (regular.has(k)) offers.set(k, [...(offers.get(k) ?? []), offer]);
  }

  // Greedy: apply the promo that saves the most on what's still unclaimed,
  // until none saves anything. A unit counts toward at most one promo.
  const remaining = new Map([...regular.keys()].map((k) => [k, qty.get(k)!]));
  const saved = new Map<string, number>();
  const applied = new Map<string, AppliedPromo[]>();
  const open = new Set(eligible);
  for (;;) {
    let best: { p: PromoDoc; ev: Evaluation } | null = null;
    for (const p of open) {
      const ev = evaluate(p, remaining, regular, weighted);
      if (ev.total > 0.5 && (!best || ev.total > best.ev.total)) best = { p, ev };
    }
    if (!best) break;
    open.delete(best.p);
    for (const [k, u] of best.ev.used) remaining.set(k, Math.max(0, remaining.get(k)! - u));
    for (const [k, s] of best.ev.savings) {
      if (s <= 0) continue;
      saved.set(k, (saved.get(k) ?? 0) + s);
      applied.set(k, [...(applied.get(k) ?? []), { ...ref(best.p), savings: Math.round(s) }]);
    }
  }

  const out: LineResult[] = [];
  let total = 0;
  for (const [key, q] of qty) {
    const reg = regular.get(key);
    if (reg === undefined) {
      out.push({ key, qty: q, available: false, regularUnit: 0, regularCost: 0, cost: 0, effectiveUnit: 0, applied: [], offers: [] });
      continue;
    }
    const rc = regularCost.get(key)!;
    const cost = Math.max(0, Math.round(rc - (saved.get(key) ?? 0)));
    total += cost;
    out.push({
      key, qty: q, available: true, regularUnit: reg, regularCost: rc, cost,
      effectiveUnit: Math.round(cost / q),
      applied: applied.get(key) ?? [],
      offers: offers.get(key) ?? [],
    });
  }
  return { store, total, regularTotal: subtotal, missing, lines: out };
}

/** Cheapest first: fewest missing items, then lowest total. */
const byValue = (a: { missing: string[]; total: number }, b: { missing: string[]; total: number }) =>
  a.missing.length - b.missing.length || a.total - b.total;

/** Price the basket at every store in `stores`, cheapest first. */
export function rankStores(
  stores: number[],
  lines: BasketLine[],
  items: Map<string, PricedItem>,
  promos: PromoDoc[],
  opts: PricingOptions,
): StoreBasket[] {
  return stores.map((s) => priceStore(s, lines, items, promos, opts)).sort(byValue);
}

/**
 * One unit (1 kg when weighted) of `key` at each of `stores`, deals applied as
 * in the product view: the cheapest store, the lowest and highest price paid,
 * how many stores sell it, and whether the cheapest is a deal. Null when none sells it.
 */
export function unitAcross(
  stores: number[],
  key: string,
  items: Map<string, PricedItem>,
  promos: PromoDoc[],
  opts: PricingOptions,
): { store: number; min: number; max: number; stores: number; onSale: boolean } | null {
  const selling = rankStores(stores, [{ key, qty: 1 }], items, promos, opts).filter((b) => !b.missing.length);
  if (!selling.length) return null;
  const best = selling[0];
  const l = best.lines[0];
  return {
    store: best.store,
    min: best.total,
    max: Math.max(...selling.map((b) => b.total)),
    stores: selling.length,
    onSale: l.cost < l.regularCost,
  };
}

export interface Split {
  stores: [StoreBasket, StoreBasket];
  total: number;
  /** Keys neither store sells. */
  missing: string[];
}

/**
 * The cheapest ways to split the basket between two stores. Each line goes to
 * the store where it costs less when the whole basket is priced there, then
 * each half is re-priced on its own (a mix & match deal may not survive the
 * split). Only splits that use both stores are returned, cheapest first.
 */
export function bestSplits(
  ranked: StoreBasket[],
  lines: BasketLine[],
  items: Map<string, PricedItem>,
  promos: PromoDoc[],
  opts: PricingOptions,
  limit = 3,
): Split[] {
  const qty = new Map<string, number>();
  for (const l of lines) if (l.qty > 0) qty.set(l.key, (qty.get(l.key) ?? 0) + l.qty);
  const lineMap = new Map(ranked.map((b) => [b.store, new Map(b.lines.map((l) => [l.key, l]))]));
  const out: Split[] = [];
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const [a, b] = [ranked[i], ranked[j]];
      const la = lineMap.get(a.store)!;
      const lb = lineMap.get(b.store)!;
      const toA: BasketLine[] = [];
      const toB: BasketLine[] = [];
      const missing: string[] = [];
      for (const [key, q] of qty) {
        const x = la.get(key)!;
        const y = lb.get(key)!;
        if (!x.available && !y.available) missing.push(key);
        else if (!y.available || (x.available && x.cost <= y.cost)) toA.push({ key, qty: q });
        else toB.push({ key, qty: q });
      }
      if (!toA.length || !toB.length) continue;
      const pa = priceStore(a.store, toA, items, promos, opts);
      const pb = priceStore(b.store, toB, items, promos, opts);
      out.push({ stores: [pa, pb], total: pa.total + pb.total, missing });
    }
  }
  return out.sort(byValue).slice(0, limit);
}

/** Effective price per unit (or kg) of `qty` of one item at one store, or null. */
export function unitPriceAt(
  store: number,
  key: string,
  qty: number,
  items: Map<string, PricedItem>,
  promos: PromoDoc[],
  opts: PricingOptions,
): number | null {
  const line = priceStore(store, [{ key, qty }], items, promos, opts).lines[0];
  return line?.available ? line.cost / qty : null;
}
