// Response shapes of /api/shopping/*, shared by the routes and the page.
// Import-free apart from types.

import type { PriceSource } from './collections.ts';
import type { AppliedPromo, Offer, Split, StoreBasket } from './pricing.ts';
import type { PromoDoc, StoreDoc } from './snapshot.ts';

export type { PriceSource } from './collections.ts';

export interface SearchHit {
  key: string;
  name: string;
  manufacturer: string;
  w: boolean;
  /** Cheapest and dearest regular price in the chosen city's stores (agorot), or null. */
  minPrice: number | null;
  maxPrice: number | null;
  /** Stores in the city that sell it. */
  stores: number;
  /** Sources the price range above comes from (empty when not sold in the city). */
  sources: PriceSource[];
  /** The store with the lowest price (chain and branch), or null when not sold in the city. */
  cheapest: { chainName: string; name: string } | null;
  /** Product photo link or null; Wolt links take ?w=<px> for a thumbnail. */
  img: string | null;
}

export interface StoreInfo {
  k: number;
  chainId: string;
  chainName: string;
  name: string;
  address: string;
  city: string | null;
  kind: 'physical' | 'online';
  /** Israel local "YYYY-MM-DDTHH:mm" of the price file, or null (always null for manual stores). */
  pricesAt: string | null;
  /** Where its prices come from — label every price with it. */
  source: PriceSource;
}

/** PUT /api/shopping/manual-prices — set (or, with null, clear) one price at a manual store. */
/** The terms of a deal beyond its description and end date (shown on hover/tap of a price). */
export interface PromoDetail {
  description: string;
  /** Units (kg when weighted) the deal starts at, from its first part. */
  minQty: number | null;
  /** Israel local "YYYY-MM-DDTHH:mm". */
  start: string;
  end: string;
  /** Basket minimum in agorot, or null. */
  minAmt: number | null;
  /** Redemption limit per customer, or null. */
  limit: number | null;
  /** The chain's remarks, as published ("" when none). */
  remarks: string;
  clubName: string | null;
  coupon: boolean;
}

export const promoDetail = (p: PromoDoc): PromoDetail => ({
  description: p.d, minQty: p.g[0]?.min ?? null,
  start: p.s, end: p.e, minAmt: p.minAmt, limit: p.limit, remarks: p.remarks ?? '',
  clubName: p.club ? p.clubName || null : null, coupon: p.coupon,
});

/** Details of the deals the given price lines mention (applied, offered or not triggered yet), keyed by promo id. */
export function promoDetails(
  promos: PromoDoc[],
  lines: { applied: { id: string }[]; offers: { id: string }[]; idle?: string[] }[],
): Record<string, PromoDetail> {
  const used = new Set<string>();
  for (const l of lines) {
    for (const p of [...l.applied, ...l.offers]) used.add(p.id);
    for (const id of l.idle ?? []) used.add(id);
  }
  return Object.fromEntries(promos.filter((p) => used.has(p._id)).map((p) => [p._id, promoDetail(p)]));
}

/**
 * Deals an item has at a store right now that the price doesn't use: a
 * multi-buy the quantity doesn't reach yet ("3 ב־100" for one pack). Promo
 * ids, the ones already applied or offered left out.
 */
export function idleDeals(
  promos: PromoDoc[], store: number, item: string, now: string, line: { applied: { id: string }[]; offers: { id: string }[] },
): string[] {
  const shown = new Set([...line.applied, ...line.offers].map((p) => p.id));
  const seen = new Set<string>();
  return promos
    .filter((p) => !shown.has(p._id) && p.s <= now && now <= p.e && p.stores.includes(store) && p.items.includes(item))
    .filter((p) => !seen.has(p.d) && seen.add(p.d)) // a chain can publish one deal under two ids
    .map((p) => p._id);
}

/** The page's view of a store doc. */
export const storeInfo = (s: StoreDoc): StoreInfo => ({
  k: s.k, chainId: s.chainId, chainName: s.chainName, name: s.name, address: s.address,
  city: s.city, kind: s.kind, pricesAt: s.pricesAt, source: s.source ?? 'official',
});

export interface ManualPriceRequest {
  store: number;
  item: string;
  /** Whole agorot, 1..100000, per kg for weighted items; null clears it. */
  price: number | null;
}

export interface ManualPriceResponse {
  store: number;
  item: string;
  price: number | null;
  by: string;
  at: string;
}

export interface CompareRequest {
  city: string;
  lines: { key: string; qty: number }[];
  /** Apply club promos too. */
  clubs?: boolean;
  /** Apply coupon promos too. */
  coupons?: boolean;
}

/** One store's price for one list item (promos applied as in the whole basket there). */
export interface ItemOption {
  store: number;
  cost: number;
  regularCost: number;
  effectiveUnit: number;
}

/** The "per item" view: where each item is cheapest among the city's physical stores. */
export interface ItemBest {
  key: string;
  qty: number;
  /** Cheapest first, at most ITEM_OPTIONS_SHOWN. Empty when no store sells it. */
  options: ItemOption[];
  /** Physical stores in the city that sell it. */
  stores: number;
}

export interface CompareResponse {
  now: string;
  city: string;
  stores: Record<number, StoreInfo>;
  items: Record<string, { name: string; manufacturer: string; w: boolean; img: string | null }>;
  /** Physical stores in the city, cheapest first. */
  physical: StoreBasket[];
  /** Online stores, cheapest first. */
  online: StoreBasket[];
  /**
   * The city's manual stores (prices typed by users), fewest missing first.
   * `missing` = the lines still to price; set one with
   * PUT /api/shopping/manual-prices { store, item, price } (agorot, null clears).
   * A manual store with nothing missing also appears in `physical`.
   */
  manual: StoreBasket[];
  /** Best two-store splits among the city's physical stores. */
  splits: Split[];
  /** Per list item, its cheapest physical stores. */
  perItem: ItemBest[];
  /** Terms of every deal named in the baskets above, by promo id. */
  promos: Record<string, PromoDetail>;
  /** Deals a shown line doesn't reach yet, by "<store>|<item key>" (promo ids). */
  idle: Record<string, string[]>;
}

/** One store's price for a single unit (1 kg when weighted) of one item, promos applied. */
export interface ItemPrice {
  store: number;
  /** Deals not triggered by one unit (promo ids; details in `promos`). */
  idle: string[];
  regularUnit: number;
  cost: number;
  applied: AppliedPromo[];
  offers: Offer[];
}

/** GET /api/shopping/item?key=<item key or scanned barcode>&city=<city id>. 404 when no such item. */
export interface ItemResponse {
  now: string;
  city: string;
  item: { key: string; name: string; manufacturer: string; w: boolean; img: string | null; barcode: boolean };
  stores: Record<number, StoreInfo>;
  /** The city's physical stores selling it (manual shops where it's priced), cheapest first. */
  physical: ItemPrice[];
  /** Online stores selling it, cheapest first. */
  online: ItemPrice[];
  /** Terms of every deal named above, by promo id. */
  promos: Record<string, PromoDetail>;
}
