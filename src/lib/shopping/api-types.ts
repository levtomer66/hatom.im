// Response shapes of /api/shopping/*, shared by the routes and the page.
// Import-free apart from types.

import type { Split, StoreBasket } from './pricing.ts';

/**
 * Where a store's prices come from. Every price the page shows is labelled
 * with its source.
 * - `official` — the chain's price-transparency file (shelf price).
 * - `wolt`     — the store's Wolt listing: delivery prices, usually above shelf.
 * - `manual`   — typed in by one of us (backend not built yet; see page.tsx).
 */
export type PriceSource = 'official' | 'wolt' | 'manual';

/** Chain id of the Wolt source (see src/lib/shopping/wolt.ts). */
export const WOLT_CHAIN_ID = 'wolt';

/**
 * The source of a store's prices, from its chain id for now: `'wolt'` is the
 * Wolt listing, a GS1 company prefix (13 digits starting 729) is an official
 * price file. Anything else is a store we add by hand.
 */
export function priceSourceOf(chainId: string): PriceSource {
  if (chainId === WOLT_CHAIN_ID) return 'wolt';
  if (/^729\d{10}$/.test(chainId)) return 'official';
  return 'manual';
}

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
}

export interface StoreInfo {
  k: number;
  chainId: string;
  chainName: string;
  name: string;
  address: string;
  city: string | null;
  kind: 'physical' | 'online';
  source: PriceSource;
  /** Israel local "YYYY-MM-DDTHH:mm" of the price file, or null. */
  pricesAt: string | null;
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
  items: Record<string, { name: string; manufacturer: string; w: boolean }>;
  /** Physical stores in the city, cheapest first. */
  physical: StoreBasket[];
  /** Online stores, cheapest first. */
  online: StoreBasket[];
  /** Best two-store splits among the city's physical stores. */
  splits: Split[];
  /** Per list item, its cheapest physical stores. */
  perItem: ItemBest[];
  /** The city's physical stores that have no prices yet (listed so prices can be added). */
  unpriced: StoreInfo[];
}
