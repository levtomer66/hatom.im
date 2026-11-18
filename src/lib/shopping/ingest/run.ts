// One run of the price ingest: the stages in order, and the run summary.
// ingest/cli.ts gives it the flags, the cache paths, the owner's picks, the
// log and (unless --dry-run) Mongo; a test gives it a temp dir and a stand-in.
//
//   1. fetch + parse the chains asked for (official.ts, wolt.ts) — each
//      chain's stores are selected once, there (select.ts)
//   2. the store registry: saved stores of chains not fetched are selected again
//   3. short store keys
//   4. the documents, from each kept store's saved state (build.ts)
//   5. the size report
//   6. diff + write (write.ts); local state is saved only after Mongo has the docs

import { CHAINS, chainBySlug, type ChainConfig } from '../chains.ts';
import { storeId } from '../collections.ts';
import { israelLocalNow, type Diff } from '../snapshot.ts';
import { buildSnapshot, sizeReport, type Snapshot } from './build.ts';
import { pruneRaw, readJson, writeJson, type CachePaths, type RunLog } from './cache.ts';
import type { IngestFlags } from './flags.ts';
import { locator } from './locate.ts';
import { ingestOfficial } from './official.ts';
import type { Picks } from './picks.ts';
import { describeKept, selector, type KeepReason } from './select.ts';
import { errorMessage } from './sources.ts';
import { assignKeys, keysPath, manualStores, registryPath, replaceFetched, stateStore, writtenPath, type Registry, type StoreRecord } from './state.ts';
import { ingestWolt, woltPhotos } from './wolt.ts';
import { ensureIndexes, forgetWritten, mongoStoreKeys, planWrites, writeCollection, writeMeta, type IngestDb, type Written } from './write.ts';

export interface IngestRun {
  flags: IngestFlags;
  paths: CachePaths;
  picks: Picks;
  log: RunLog;
  /** Mongo, or null on a dry run. */
  db: IngestDb | null;
  /** Uncompressed BSON size of a doc (the driver's BSON.calculateObjectSize). */
  sizeOf: (doc: object) => number;
}

export interface IngestResult {
  /** Every store the run keeps, by store id, in the order the docs are built in. */
  registry: Registry;
  /** Why each official store is kept. */
  why: Map<string, KeepReason>;
  snapshot: Snapshot;
  plan: [name: string, diff: Diff<{ _id: string }>][];
}

const isOfficial = (s: { chainSlug: string }) => s.chainSlug !== 'wolt' && s.chainSlug !== 'manual';

export async function runIngest({ flags, paths, picks, log: runLog, db, sizeOf }: IngestRun): Promise<IngestResult> {
  const { log, warn } = runLog;
  const slugs = flags.chains ?? CHAINS.map((c) => c.slug);
  const chains = slugs.map((s): ChainConfig => {
    const c = chainBySlug(s);
    if (!c) throw new Error(`unknown chain "${s}" (known: ${CHAINS.map((x) => x.slug).join(', ')})`);
    return c;
  });
  log(`run ${runLog.id}${flags.dryRun ? ' (dry run)' : ''}${flags.offline ? ' (offline)' : ''} — chains: ${slugs.join(', ')}; cache: ${paths.root}`);
  // A dry run or an offline run reads the raw cache (re-parsing saved state), so it never thins it.
  if (flags.pruneRaw) pruneRaw(paths.raw, log);

  const state = stateStore(paths, log);
  // --offline: the locator answers from its caches only and makes no request.
  const select = selector(picks, locator(paths.places, picks, { offline: flags.offline }));
  const saved = readJson<Registry>(registryPath(paths.state), {});
  const why = new Map<string, KeepReason>();

  // 1. Fetch + parse the chains asked for (others keep their saved state).
  const run = { rawDir: paths.raw, state, select, log, warn, maxStores: flags.maxStores };
  const fresh: StoreRecord[] = [];
  for (const chain of flags.offline ? [] : chains) {
    try {
      if (chain.source.kind === 'wolt') fresh.push(...(await ingestWolt(chain, { ...run, saved })));
      else if (chain.source.kind === 'manual') {
        const shops = manualStores(chain, select.selectManual(), state);
        log(`${chain.slug}: ${shops.length} included shops with no price source (from places/decisions.json)`);
        fresh.push(...shops);
      } else {
        for (const k of await ingestOfficial(chain, run)) {
          fresh.push(k.store);
          why.set(storeId(k.store), k.reason);
        }
      }
    } catch (e) {
      warn(`${chain.slug}: chain skipped — ${errorMessage(e)}`);
    }
  }

  // 2. Store registry. A chain that came back with stores replaces its saved
  //    ones. Saved official stores of every other chain (other --chains,
  //    --offline, a chain that failed) are selected again from their records,
  //    so a changed decision or pin takes effect without fetching; Wolt and
  //    manual stores of a run that didn't fetch them stay as saved.
  const registry = replaceFetched(saved, fresh);
  const others = Object.values(registry).filter(isOfficial);
  const again = await select.selectSaved(others, (s) => !!state.load(s)?.priceFile);
  for (const d of again.dropped) {
    if (d.note) warn(d.note);
    delete registry[storeId(d.store)];
  }
  for (const k of again.kept) {
    if (k.note) warn(k.note);
    if (k.reason === 'fallback') log(`  ${k.store.chainSlug} ${k.store.storeId} ${k.store.name}: kept as the chain's only store`);
    registry[storeId(k.store)] = k.store; // in place: the registry's order is the order the docs are built in
    why.set(storeId(k.store), k.reason);
  }
  if (others.length) log(`saved stores of chains not fetched this run: kept ${again.kept.length} of ${others.length}: ${describeKept(again.kept)}`);
  for (const s of fresh) registry[storeId(s)] = s;
  const stores = Object.values(registry);
  {
    const reasons = stores.flatMap((s) => (why.has(storeId(s)) ? [{ reason: why.get(storeId(s))! }] : []));
    const count = (slug: string) => stores.filter((s) => s.chainSlug === slug).length;
    log(`stores kept: ${stores.length} — ${describeKept(reasons)}, ${count('wolt')} Wolt venues, ${count('manual')} manual shops`);
  }

  // 3. Short store keys — Mongo is the authority when we have it.
  const keys = assignKeys(stores, (db && (await mongoStoreKeys(db))) ?? readJson<Record<string, number>>(keysPath(paths.state), {}));

  // 4. Desired documents, from each kept store's saved state.
  const nowLocal = israelLocalNow();
  const photos = await woltPhotos(picks.woltVenues, { rawDir: paths.raw, offline: flags.offline, log, warn });
  const snapshot = buildSnapshot({ stores, keys, state, cacheDir: paths.root, woltPhotos: photos, nowLocal, log });

  // 5. Size report (uncompressed BSON — what Atlas M0 counts).
  for (const line of sizeReport(snapshot, sizeOf)) log(line);

  // 6. Diff + write.
  const written = readJson<Written>(writtenPath(paths.state), {});
  if (flags.full && db) await forgetWritten(db, written);
  const plan = planWrites(snapshot, written);
  for (const [name, d] of plan) log(`  diff ${name}: ${d.upserts.length} to write, ${d.deletes.length} to delete`);

  if (db) {
    await ensureIndexes(db);
    for (const [name, d] of plan) {
      await writeCollection(db, name, d.upserts, d.deletes, log);
      written[name] = d.next; // persisted per collection, so a crash mid-run only repeats the rest
      writeJson(writtenPath(paths.state), written);
    }
    await writeMeta(db, { at: new Date(), nowLocal, stores: snapshot.stores.size, items: snapshot.items.size, promos: snapshot.promos.size });
    writeJson(keysPath(paths.state), keys);
    // Local state changes only after Mongo has the matching docs, and never on a dry run.
    writeJson(registryPath(paths.state), registry);
    state.prune((id) => id in registry); // a store that left the target set
  }
  log(`done — log: ${runLog.file}`);
  return { registry, why, snapshot, plan };
}
