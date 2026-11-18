// Mongo collection names and the store-key scheme shared by the ingest job
// and (later) the app's read models. Import-free.

export const COLLECTIONS = {
  chains: 'shoppingChains',
  stores: 'shoppingStores',
  items: 'shoppingItems',
  promos: 'shoppingPromos',
  meta: 'shoppingMeta',
  /** Written by the app, not the ingest: prices people typed for manual stores. */
  manualPrices: 'shoppingManualPrices',
} as const;

/**
 * Where a store's prices come from. official = the price-transparency files;
 * wolt = Wolt delivery prices (usually above shelf price); manual = typed in
 * by users for a shop that publishes nothing.
 */
export type PriceSource = 'official' | 'wolt' | 'manual';
export const WOLT_CHAIN_ID = 'wolt';
export const MANUAL_CHAIN_ID = 'manual';
export const priceSourceOf = (chainId: string): PriceSource =>
  chainId === WOLT_CHAIN_ID ? 'wolt' : chainId === MANUAL_CHAIN_ID ? 'manual' : 'official';

/** The collections the ingest diffs and rewrites (meta is overwritten every run). */
export const SNAPSHOT_COLLECTIONS = [COLLECTIONS.chains, COLLECTIONS.stores, COLLECTIONS.items, COLLECTIONS.promos] as const;

/** A store's stable id: "<chainId>:<storeId>" (storeId with leading zeros stripped). */
export type StoreId = `${string}:${string}`;

export const storeId = (s: { chainId: string; storeId: string }): StoreId => `${s.chainId}:${s.storeId}`;
