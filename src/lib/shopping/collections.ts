// Mongo collection names and the store-key scheme shared by the ingest job
// and (later) the app's read models. Import-free.

export const COLLECTIONS = {
  chains: 'shoppingChains',
  stores: 'shoppingStores',
  items: 'shoppingItems',
  promos: 'shoppingPromos',
  meta: 'shoppingMeta',
} as const;

/** The collections the ingest diffs and rewrites (meta is overwritten every run). */
export const SNAPSHOT_COLLECTIONS = [COLLECTIONS.chains, COLLECTIONS.stores, COLLECTIONS.items, COLLECTIONS.promos] as const;

/** A store's stable id: "<chainId>:<storeId>" (storeId with leading zeros stripped). */
export type StoreId = `${string}:${string}`;

export const storeId = (s: { chainId: string; storeId: string }): StoreId => `${s.chainId}:${s.storeId}`;
