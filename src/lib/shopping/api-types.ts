// Response shapes of /api/shopping/*, shared by the routes and the page.
// Import-free apart from types and the (import-free) pricing engine.

import type { PriceSource } from './collections.ts';
import { dealMinQty, type AppliedPromo, type Offer, type StoreBasket } from './pricing.ts';
import type { PromoDoc, StoreDoc } from './snapshot.ts';
import type { Nutrition } from './nutrition.ts';
import type { Invite } from './household.ts';
import type { Where } from './near.ts';

export type { PriceSource } from './collections.ts';

/**
 * Where a product photo came from when it isn't the item's own: 'name' = the
 * same product under another code or size (an illustration), 'off' = Open
 * Food Facts (CC BY-SA: must be credited where shown). Null/absent = its own.
 */
export type ImgBy = 'name' | 'off' | null;

/** The item doc's `imgBy` (written by the ingest since e82e391), read before that type is merged. */
export const imgByOf = (d: object): ImgBy => {
  const v = (d as { imgBy?: unknown }).imgBy;
  return v === 'name' || v === 'off' ? v : null;
};

export interface SearchHit {
  key: string;
  name: string;
  manufacturer: string;
  w: boolean;
  /** One unit's (1 kg's) lowest and highest price in the near stores, deals applied (agorot), or null. */
  minPrice: number | null;
  maxPrice: number | null;
  /** Near stores that sell it. */
  stores: number;
  /** Sources the price range above comes from (empty when no near store sells it). */
  sources: PriceSource[];
  /** The store with the lowest price (chain and branch), or null when no near store sells it. */
  cheapest: { chainName: string; name: string } | null;
  /** The cheapest price is a deal's. */
  onSale: boolean;
  /** The cheapest price is a multi-buy's per unit: it takes buying several (shown with an asterisk). */
  multi?: boolean;
  /** Product photo link or null; Wolt links take ?w=<px> for a thumbnail. */
  img: string | null;
  imgBy: ImgBy;
}

export interface StoreInfo {
  k: number;
  chainId: string;
  chainName: string;
  name: string;
  address: string;
  kind: 'physical' | 'online';
  /** Israel local "YYYY-MM-DDTHH:mm" of the price file, or null (always null for manual stores). */
  pricesAt: string | null;
  /** Where its prices come from — label every price with it. */
  source: PriceSource;
  /** Walking minutes from the nearest pin (ingest), or null (online, unknown). */
  walkMin: number | null;
  /** Metres from the request's centre (your location or the home spot), or null (online, no point, no centre). */
  distM: number | null;
}

/** PUT /api/shopping/manual-prices — set (or, with null, clear) one price at a manual store. */
/** The terms of a deal beyond its description and end date (shown on hover/tap of a price). */
export interface PromoDetail {
  description: string;
  /** Units (kg when weighted) the deal needs before it saves anything (dealMinQty). */
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
  description: p.d, minQty: dealMinQty(p),
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
export const storeInfo = (s: StoreDoc & { distM?: number | null }): StoreInfo => ({
  k: s.k, chainId: s.chainId, chainName: s.chainName, name: s.name, address: s.address,
  kind: s.kind, pricesAt: s.pricesAt, source: s.source ?? 'official',
  // Written by the ingest since dcfc209 (feature/shopping-ingest); read here before that type is merged.
  walkMin: (s as StoreDoc & { walkMin?: number | null }).walkMin ?? null,
  distM: s.distM ?? null,
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

/**
 * POST /api/shopping/compare. `lat`/`lng`: where you are (rounded server-side,
 * never stored); without them the household's home spot. `r`: radius in km
 * (1, 2, 5 or 10; default 1).
 */
export interface CompareRequest {
  lat?: number;
  lng?: number;
  r?: number;
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

/** The "per item" view: where each item is cheapest among the near physical stores. */
export interface ItemBest {
  key: string;
  qty: number;
  /** Cheapest first, at most ITEM_OPTIONS_SHOWN. Empty when no store sells it. */
  options: ItemOption[];
  /** Near physical stores that sell it. */
  stores: number;
}

/** One stop of a plan: the store and its items, priced on their own. */
export interface PlanStop {
  store: number;
  basket: StoreBasket;
}

export interface ShoppingPlan {
  kind: 'one-store' | 'cheapest';
  /** One for 'one-store', two or three for 'cheapest' (in no particular order yet). */
  stops: PlanStop[];
  total: number;
  /** Items no stop sells. */
  missing: string[];
}

export interface Plans {
  oneStore: ShoppingPlan | null;
  /** byCount[worth] when a split is worth it, else the smallest split; null when no split exists. */
  cheapest: ShoppingPlan | null;
  /** oneStore − cheapest, agorot (0 when either is missing). */
  saving: number;
  /** worth > 1. */
  splitPays: boolean;
  /** The cheapest plan over exactly that many stores; a count that adds no store is missing. */
  byCount: Partial<Record<number, ShoppingPlan>>;
  /** Stores worth walking to: each extra one covers more items or saves SPLIT_MIN_SAVING (worthCount). */
  worth: number;
}

export interface CompareResponse {
  now: string;
  /** Which stores counted: the centre, where it came from, and the radius. */
  where: Where;
  stores: Record<number, StoreInfo>;
  /** `d`: department id (departments.ts) when known. */
  items: Record<string, { name: string; manufacturer: string; w: boolean; img: string | null; imgBy?: ImgBy; d?: string | null }>;
  /** Near physical stores (and ★), cheapest first. */
  physical: StoreBasket[];
  /** Online stores, cheapest first. */
  online: StoreBasket[];
  /**
   * The near manual stores (prices typed by users), fewest missing first.
   * `missing` = the lines still to price; set one with
   * PUT /api/shopping/manual-prices { store, item, price } (agorot, null clears).
   * A manual store with nothing missing also appears in `physical`.
   */
  manual: StoreBasket[];
  /** Per list item, its cheapest physical stores. */
  perItem: ItemBest[];
  /** The two ways to shop the list (docs/shopping-in-store-mode.md). */
  plans: Plans;
  /** Terms of every deal named in the baskets above, by promo id. */
  promos: Record<string, PromoDetail>;
  /** Deals a shown line doesn't reach yet, by "<store>|<item key>" (promo ids). */
  idle: Record<string, string[]>;
}

/** What a store card (rank, total, breakdown) reads besides its basket. */
export type StoreCardData = Pick<CompareResponse, 'now' | 'stores' | 'items' | 'promos' | 'idle'>;

/**
 * POST /api/shopping/far { stores, lines, clubs?, coupons? } — "כמה יעלה לי ב…": the
 * list at each of the household's favorite stores (wherever they are), complete
 * baskets cheapest first, then those missing items.
 */
export type FarResponse = StoreCardData & { baskets: StoreBasket[] };

/** One store's price for a single unit (1 kg when weighted) of one item, promos applied. */
export interface ItemPrice {
  store: number;
  /** Deals not triggered by one unit (promo ids; details in `promos`). */
  idle: string[];
  regularUnit: number;
  /** The price of one unit, deals applied; a multi-buy at its per-unit price ("2 ב-10" → ₪5), see `multi`. */
  cost: number;
  applied: AppliedPromo[];
  offers: Offer[];
  /** Set when `cost` is a multi-buy's per-unit price: its quantity, per-unit and total (shown with an asterisk). */
  multi?: { qty: number; unit: number; total: number } | null;
}

/** GET /api/shopping/item?key=<item key or scanned barcode>&lat&lng&r. 404 when no such item. */
export interface ItemResponse {
  now: string;
  where: Where;
  item: {
    key: string; name: string; manufacturer: string; w: boolean; img: string | null; imgBy: ImgBy; barcode: boolean;
    /** Nutrition per 100 g (100 ml for drinks), or null when no source has it. */
    nu: Nutrition | null;
    /** Grams (ml) in one pack, from the price file; null when sold by the unit or unknown. */
    pack: number | null;
    /** A drink sold by volume: its values and red labels are per 100 ml. */
    liquid: boolean;
    /** Department id, or null. */
    d: string | null;
  };
  stores: Record<number, StoreInfo>;
  /** The near physical stores selling it (manual shops where it's priced), cheapest first. */
  physical: ItemPrice[];
  /** Online stores selling it, cheapest first. */
  online: ItemPrice[];
  /** Terms of every deal named above, by promo id. */
  promos: Record<string, PromoDetail>;
}

// ── "אני בסופר" (docs/shopping-here-mode.md) ──

/** A store for the "אני בסופר" picker. */
export interface HereStore extends StoreInfo {
  /** Where the store is, when the ingest geocoded it (`loc` on the store doc); null until then. */
  loc: { lat: number; lng: number } | null;
  /** We have prices for it: a price file, or (a manual shop) at least one typed price. */
  priced: boolean;
}

/** GET /api/shopping/here/stores?lat&lng — physical stores within 10 km of you (else the home spot), plus ★, for the picker (sorted on the device). */
export interface HereStoresResponse {
  now: string;
  stores: HereStore[];
}

/**
 * GET /api/shopping/stores?q=<text> — priced stores anywhere whose chain,
 * branch, town or address has every word of `q` (max 30); without `q`, the
 * household's favorites. Sorted on the device.
 */
/**
 * GET /api/shopping/household — the caller's household: its members (with
 * display names), its pending invites, and invites to the caller from other
 * households (`loses`: My items + list lines deleted with the caller's
 * current household if they accept). POST answers with the same shape.
 */
export interface HouseholdResponse {
  id: string;
  members: { email: string; name: string }[];
  invites: Invite[];
  incoming: { id: string; by: string; byName: string; at: string; loses: number }[];
}

export interface StoresResponse {
  now: string;
  stores: HereStore[];
}

/** One list item at the chosen store (here.ts groups them). */
export interface HereRow {
  key: string;
  /** The quantity wanted: the shopping list's, else the usual one from My items (units, or kg when weighted). */
  qty: number;
  /** On the shopping list (else only in My items). */
  onList: boolean;
  /** One unit's price here (1 kg when weighted), deals applied, or null when the store doesn't sell it. */
  here: ItemPrice | null;
  /** The cheapest physical store's price for one unit (may be this store), or null when none sells it. */
  best: ItemPrice | null;
  group: 'best' | 'ok' | 'elsewhere' | 'missing';
  /** Agorot the cheapest store saves on `qty`; 0 in 'best' and 'missing'. */
  saving: number;
}

/**
 * GET /api/shopping/here?store=<store key>&r=<km> — every item on the
 * caller's lists priced here and at the physical stores within r of this one
 * (plus ★), and the
 * items bought on past trips that are on a deal here now.
 */
export interface HereResponse {
  now: string;
  /** Centred on the store itself. */
  where: Where;
  store: StoreInfo;
  /** Every store named in `rows`. */
  stores: Record<number, StoreInfo>;
  items: Record<string, { name: string; manufacturer: string; w: boolean; img: string | null; imgBy: ImgBy; d: string | null }>;
  /** The caller's lists (for the filter chips). */
  rows: HereRow[];
  /** Not in My items, bought on a recent trip, and on a deal here now (biggest saving first). */
  before: { key: string; here: ItemPrice }[];
  /** Terms of every deal named above, by promo id. */
  promos: Record<string, PromoDetail>;
}

/**
 * GET /api/shopping/here/deals?store=<store key> — every item's
 * best deal at the store now, biggest share saved first (here.ts storeDeals).
 */
export interface HereDealsResponse {
  now: string;
  /** More deals than the ones sent (the smallest savings are left out). */
  more: boolean;
  deals: {
    key: string;
    promo: string;
    /** Units the deal is priced for (kg when weighed). */
    qty: number;
    cost: number;
    regularCost: number;
    pct: number;
    end: string;
    club: boolean;
    coupon: boolean;
  }[];
  items: Record<string, { name: string; w: boolean; img: string | null; imgBy: ImgBy; d: string | null }>;
  promos: Record<string, PromoDetail>;
}

// ── nutrition (docs/shopping-nutrition.md) ──

/** What the list's nutrition totals need per item. */
export interface ItemNutrition {
  nu: Nutrition | null;
  pack: number | null;
  w: boolean;
  liquid: boolean;
  d: string | null;
  name: string;
}

/** GET /api/shopping/nutrition?keys=<k1,k2,…> (≤ 100 keys): per item key; unknown keys are left out. */
export type NutritionResponse = Record<string, ItemNutrition>;

/** GET / PUT /api/shopping/settings: the caller's /shopping preferences (the ⚙ menu). */
export interface ShoppingSettings {
  /** Show the list's nutrition totals above it. Off by default. */
  nutritionHero: boolean;
}
