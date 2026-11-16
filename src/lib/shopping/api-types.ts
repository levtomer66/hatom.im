// Response shapes of /api/shopping/*, shared by the routes and the page.
// Import-free apart from types.

import type { PriceSource } from './collections.ts';
import type { Split, StoreBasket } from './pricing.ts';

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
}
