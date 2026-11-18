// What the ingest remembers between runs, under state/ in the cache dir:
//
//   stores/<chain>-<store>.json.gz   a store's latest parsed items and promos
//   stores.json                      the store registry: every store the last run kept
//   keys.json                        store id → the short numeric key used in price maps
//
// The formats are fixed: a run of the old code and a run of this one read each
// other's files.

import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { ChainConfig } from '../chains.ts';
import { storeId, type StoreId } from '../collections.ts';
import { parsePriceFile, parsePromoFile, type CanonItem, type CanonPromo, type CanonStore } from '../normalize.ts';
import { toXml } from './cache.ts';
import type { ManualShop } from './picks.ts';

/**
 * Bump when parsing/normalizing changes what lands in saved state. A saved
 * state from another version is re-parsed from the raw cache (or, if the raw
 * file was pruned, its file names are cleared so the next fetch re-parses).
 */
export const PARSER_VERSION = 2;

export interface SavedStoreState {
  parser?: number;
  chainId: string;
  storeId: string;
  priceFile: string | null;
  promoFile: string | null;
  items: CanonItem[];
  promos: CanonPromo[];
}

/** One store of the registry (state/stores.json). */
export interface StoreRecord extends CanonStore {
  chainSlug: string;
  chainName: string;
  /** Target city id; null for an online store outside the target cities. */
  cityId: string | null;
  /** Map point, set when the store is selected (ingest/select.ts); it becomes the store doc's `loc`. */
  at?: { lat: number; lng: number };
  /** Kept as the chain's only store: no store of the chain near a pin has prices (ingest/select.ts fallbackOrder). */
  keptAs?: 'fallback';
}

export type Registry = Record<string, StoreRecord>;

export const emptyState = (chainId: string, id: string): SavedStoreState => ({ chainId, storeId: id, priceFile: null, promoFile: null, items: [], promos: [] });

type StoreRef = { chainId: string; storeId: string; chainSlug: string };

export interface StateStore {
  /** A store's saved state, or null when it has none. Read from disk once per run. */
  load(store: StoreRef): SavedStoreState | null;
  /** Writes the state; it is what load returns from then on. */
  save(state: SavedStoreState): void;
  /** Deletes the state files of stores `keep` rejects; returns how many. */
  prune(keep: (id: StoreId) => boolean): number;
}

/**
 * Saved store state, remembered for the length of a run: gunzipping and
 * parsing a store's items and promos used to happen 3–4 times per store.
 */
export function stateStore(paths: { storeState: string; raw: string }, log: (msg: string) => void): StateStore {
  // File name is the StoreId with ':' → '-' (chain ids are digits, so the first '-' splits them back).
  const pathOf = (id: StoreId) => join(paths.storeState, `${id.replace(':', '-')}.json.gz`);
  const idOf = (file: string) => file.replace(/\.json\.gz$/, '').replace('-', ':') as StoreId;
  const memo = new Map<StoreId, SavedStoreState | null>();

  function save(s: SavedStoreState): void {
    writeFileSync(pathOf(storeId(s)), gzipSync(JSON.stringify({ ...s, parser: PARSER_VERSION })));
    memo.set(storeId(s), s);
  }

  function read(store: StoreRef): SavedStoreState | null {
    const p = pathOf(storeId(store));
    if (!existsSync(p)) return null;
    const st = JSON.parse(gunzipSync(readFileSync(p)).toString('utf8')) as SavedStoreState;
    // Wolt state has no price file to re-parse from; its items are rebuilt by the next fetch.
    if (st.parser === PARSER_VERSION || store.chainSlug === 'wolt' || store.chainSlug === 'manual') return st;
    const raw = (file: string | null) => (file ? join(paths.raw, store.chainSlug, file) : null);
    const priceRaw = raw(st.priceFile);
    const promoRaw = raw(st.promoFile);
    if (priceRaw && existsSync(priceRaw)) st.items = parsePriceFile(toXml(new Uint8Array(readFileSync(priceRaw)))).items;
    else st.priceFile = null;
    if (promoRaw && existsSync(promoRaw)) st.promos = parsePromoFile(toXml(new Uint8Array(readFileSync(promoRaw)))).promos;
    else st.promoFile = null;
    save(st);
    log(`  re-parsed saved state of ${storeId(store)} (parser v${st.parser ?? 1} → v${PARSER_VERSION})`);
    return st;
  }

  return {
    load(store) {
      const id = storeId(store);
      if (!memo.has(id)) memo.set(id, read(store));
      return memo.get(id)!;
    },
    save,
    prune(keep) {
      let n = 0;
      for (const f of readdirSync(paths.storeState)) {
        if (keep(idOf(f))) continue;
        rmSync(join(paths.storeState, f));
        memo.delete(idOf(f));
        n++;
      }
      return n;
    },
  };
}

export const registryPath = (stateDir: string) => join(stateDir, 'stores.json');
export const keysPath = (stateDir: string) => join(stateDir, 'keys.json');
export const writtenPath = (stateDir: string) => join(stateDir, 'written.json');

/**
 * The saved registry without the stores of the chains this run fetched: a
 * chain that came back with stores replaces its saved ones (the caller adds
 * the fresh records after these). A chain that failed, or came back with no
 * store at all, keeps its saved stores, which are then selected again.
 */
export function replaceFetched(saved: Registry, fresh: StoreRecord[]): Registry {
  const fetched = new Set(fresh.map((s) => s.chainId));
  return Object.fromEntries(Object.entries(saved).filter(([, s]) => !fetched.has(s.chainId)));
}

/** Short store keys: a store keeps its key; a new store takes the next number. */
export function assignKeys(stores: { chainId: string; storeId: string }[], existing: Record<string, number>): Record<string, number> {
  const keys = { ...existing };
  let max = Math.max(0, ...Object.values(keys));
  for (const s of stores) {
    const id = storeId(s);
    if (!(id in keys)) keys[id] = ++max;
  }
  return keys;
}

/**
 * The neighbourhood shops with no price source (ingest/picks.ts manualShops)
 * as store records: listed with no items; users type their prices in the app
 * (shoppingManualPrices). Store id = hash of the discovery row id, so it is
 * stable across runs.
 */
export function manualStores(chain: ChainConfig, shops: ManualShop[], state: StateStore): StoreRecord[] {
  const out = shops.map((m): StoreRecord => ({
    chainId: chain.chainId, storeId: m.id, subChainId: '', name: m.name, address: m.address, city: m.city, kind: 'physical',
    chainSlug: chain.slug, chainName: chain.name, cityId: m.city, at: m.at,
  }));
  for (const rec of out) if (!state.load(rec)) state.save(emptyState(chain.chainId, rec.storeId));
  return out;
}
