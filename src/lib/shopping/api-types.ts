// Response shapes of /api/shopping/*, shared by the routes and the page.
// Import-free apart from types.

import type { Split, StoreBasket } from './pricing.ts';

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
}

export interface StoreInfo {
  k: number;
  chainId: string;
  chainName: string;
  name: string;
  address: string;
  city: string | null;
  kind: 'physical' | 'online';
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
}
