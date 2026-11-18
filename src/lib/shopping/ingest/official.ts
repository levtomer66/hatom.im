// One price-transparency chain, start to finish: its Stores file → the one
// selection of its stores (ingest/select.ts) → the PriceFull / PromoFull
// listings of the kept stores → the fallback store when none has prices →
// parse and save each store's state.

import type { ChainConfig } from '../chains.ts';
import { cityOf } from '../cities.ts';
import { parsePriceFile, parsePromoFile, parseStoresFile } from '../normalize.ts';
import { REQUEST_GAP_MS, fetchCached, toXml } from './cache.ts';
import { describeKept, fallbackOrder, needsFallback, type Dropped, type KeepReason, type Selector } from './select.ts';
import { Throttle, clientFor, errorMessage, type RemoteFile, type SourceClient } from './sources.ts';
import { emptyState, type StateStore, type StoreRecord } from './state.ts';

/** What a chain's run needs from the job. */
export interface ChainRun {
  /** The raw cache dir (raw/<chain>/<file>). */
  rawDir: string;
  state: StateStore;
  select: Selector;
  log(msg: string): void;
  warn(msg: string): void;
  /** --max-stores: a sample of the first N kept stores (a dry run). */
  maxStores: number | null;
}

/** A store the run keeps, and why. */
export interface KeptStore {
  store: StoreRecord;
  reason: KeepReason;
}

/**
 * The store a chain keeps when none near a pin has prices: the first of
 * fallbackOrder() that publishes a PriceFull. Listing-based clients answer from
 * one cached listing; Shufersal asks per store, nearest first, so it stops early.
 */
async function fallbackFor(dropped: Dropped<StoreRecord>[], select: Selector, client: SourceClient) {
  const cands = await select.fallbackCandidates(dropped);
  const byKey = new Map(cands.map((c) => [c.cand.key, c]));
  for (const key of fallbackOrder(cands.map((c) => c.cand))) {
    const { store, cand } = byKey.get(key)!;
    const file = (await client.latestFor('PriceFull', [store.storeId])).get(store.storeId);
    if (file) return { store: { ...store, keptAs: 'fallback' as const }, file, distM: cand.distM };
  }
  return null;
}

export async function ingestOfficial(
  chain: ChainConfig,
  run: ChainRun,
  client: SourceClient = clientFor(chain, new Throttle(REQUEST_GAP_MS)),
): Promise<KeptStore[]> {
  const { state, log, warn } = run;
  const download = (f: RemoteFile) => fetchCached(run.rawDir, chain.slug, f, (x) => client.download(x));

  const storesFile = await client.latestStores();
  if (!storesFile) throw new Error(`${chain.slug}: no Stores file listed`);
  const parsed = parseStoresFile(toXml(await download(storesFile)));
  const seen = new Set<string>(); // some Stores files list a store more than once
  const listed: StoreRecord[] = parsed.stores
    .filter((s) => !seen.has(s.storeId) && !!seen.add(s.storeId))
    .map((s) => ({ ...s, chainSlug: chain.slug, chainName: chain.name, cityId: cityOf(s) }));

  // The one selection of this chain's stores, before the price listing is asked for.
  const sel = await run.select.selectOfficial(listed);
  for (const x of [...sel.kept, ...sel.dropped]) if (x.note) warn(x.note);
  const kept: KeptStore[] = run.maxStores === null ? sel.kept : sel.kept.slice(0, run.maxStores);
  const candidates = listed.length - sel.dropped.filter((d) => d.reason === 'no-city' || d.reason === 'online-unlisted').length;
  log(`${chain.slug}: ${parsed.stores.length} stores listed (${storesFile.name}), ${candidates} in target cities or online; kept ${kept.length}: ${describeKept(kept)}`);

  const prices = await client.latestFor('PriceFull', kept.map((k) => k.store.storeId));
  // Every chain keeps a priced store.
  if (needsFallback(kept.map((k) => ({ publishesToday: prices.has(k.store.storeId), savedPrices: !!state.load(k.store)?.priceFile })))) {
    const fb = await fallbackFor(sel.dropped, run.select, client);
    if (fb) {
      kept.push({ store: fb.store, reason: 'fallback' });
      prices.set(fb.store.storeId, fb.file);
      log(`  ${fb.store.storeId} ${fb.store.name}: kept as the chain's only store (${fb.distM === null ? 'not placed' : `${(fb.distM / 1000).toFixed(1)} km from the nearest pin`})`);
    } else warn(`${chain.slug}: no store in the target cities publishes a PriceFull — the chain has no store`);
  }
  const promos = await client.latestFor('PromoFull', kept.map((k) => k.store.storeId));

  const out: KeptStore[] = [];
  for (const k of kept) {
    const s = k.store;
    const priceFile = prices.get(s.storeId) ?? null;
    const promoFile = promos.get(s.storeId) ?? null;
    if (!priceFile) warn(`${chain.slug} store ${s.storeId} (${s.name}): no PriceFull listed — keeping previous prices`);
    if (!promoFile) warn(`${chain.slug} store ${s.storeId} (${s.name}): no PromoFull listed — keeping previous promos`);
    const next = state.load(s) ?? emptyState(chain.chainId, s.storeId);
    try {
      if (priceFile && priceFile.name !== next.priceFile) {
        const r = parsePriceFile(toXml(await download(priceFile)));
        if (r.storeId !== s.storeId) warn(`${priceFile.name}: header store ${r.storeId} ≠ listed ${s.storeId}`);
        if (r.skipped) warn(`${priceFile.name}: skipped ${r.skipped} item records (no code / no price)`);
        if (!r.items.length) throw new Error(`${priceFile.name}: no items parsed`);
        next.items = r.items;
        next.priceFile = priceFile.name;
      }
      if (promoFile && promoFile.name !== next.promoFile) {
        const r = parsePromoFile(toXml(await download(promoFile)));
        if (r.skipped) warn(`${promoFile.name}: skipped ${r.skipped} promotion records`);
        next.promos = r.promos;
        next.promoFile = promoFile.name;
      }
    } catch (e) {
      warn(`${chain.slug} store ${s.storeId}: skipped file — ${errorMessage(e)}`);
    }
    state.save(next);
    log(`  ${s.storeId.padStart(4)} ${(s.cityId ?? s.kind).padEnd(10)} ${s.name} — ${next.items.length} items, ${next.promos.length} promos`);
    // A fallback exists to give its chain prices: one whose file could not be read is not kept.
    if (k.reason === 'fallback' && !next.priceFile) warn(`${chain.slug} store ${s.storeId}: the chain's only store has no prices — left out`);
    else out.push(k);
  }
  return out;
}
