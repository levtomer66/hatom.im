// Shopping price ingest — a local job you run by hand.
//
//   npm run shopping:ingest -- --dry-run                 # fetch + parse, print sizes, no DB
//   npm run shopping:ingest -- --chains yohananof         # one chain
//   npm run shopping:ingest -- --max-stores 2 --dry-run   # quick smoke run (a sample: only with --dry-run)
//   npm run shopping:ingest -- --full                     # rewrite every doc (new machine / lost state)
//   npm run shopping:ingest -- --offline                  # no fetching, no network: rebuild docs from saved state
//
// Needs MONGODB_URI (with write access) unless --dry-run. The npm script loads
// .env.shopping if present (gitignored via .env*). The cache dir is described
// in ingest/cache.ts; the owner's files in ingest/picks.ts.
//
// This file is the wiring: the flags (flags.ts), the stages in order and the
// run summary. The rules live in the stages:
//   picks.ts   the owner's files            select.ts  which stores are kept
//   locate.ts  where a store is             official.ts / wolt.ts  one chain's run
//   state.ts   what is saved between runs   build.ts   saved state → documents
//   write.ts   documents → Mongo
// Only this file has top-level side effects or reads process.argv.

import { BSON, MongoClient } from 'mongodb';
import { CHAINS, chainBySlug, type ChainConfig } from '../chains.ts';
import { storeId } from '../collections.ts';
import { israelLocalNow } from '../snapshot.ts';
import { buildSnapshot, sizeReport } from './build.ts';
import { cachePaths, ensureCacheDirs, pruneRaw, readJson, runLog, writeJson } from './cache.ts';
import { parseIngestFlags, type IngestFlags } from './flags.ts';
import { locator } from './locate.ts';
import { ingestOfficial } from './official.ts';
import { loadPicks, type Picks } from './picks.ts';
import { describeKept, selector, type KeepReason } from './select.ts';
import { errorMessage } from './sources.ts';
import { assignKeys, keysPath, manualStores, registryPath, replaceFetched, stateStore, writtenPath, type Registry, type StoreRecord } from './state.ts';
import { ingestWolt, woltPhotos } from './wolt.ts';
import { ensureIndexes, forgetWritten, mongoStoreKeys, planWrites, writeCollection, writeMeta, type IngestDb, type Written } from './write.ts';

/** Stops the run before anything is fetched or written. */
function stop(msg: string): never {
  console.error(msg);
  process.exit(1);
}

let flags: IngestFlags;
let picks: Picks;
const paths = cachePaths();
try {
  flags = parseIngestFlags(process.argv.slice(2));
  // Only stores near the pins, or picked by hand, are ingested: no pins, no run.
  picks = loadPicks(paths.places);
} catch (e) {
  stop(errorMessage(e));
}
ensureCacheDirs(paths);

const { id: runId, file: logFile, log, warn } = runLog(paths.logs);
const state = stateStore(paths, log);
// --offline: the locator answers from its caches only and makes no request.
const select = selector(picks, locator(paths.places, picks, { offline: flags.offline }));

const isOfficial = (s: { chainSlug: string }) => s.chainSlug !== 'wolt' && s.chainSlug !== 'manual';

async function main() {
  const slugs = flags.chains ?? CHAINS.map((c) => c.slug);
  const chains = slugs.map((s): ChainConfig => {
    const c = chainBySlug(s);
    if (!c) throw new Error(`unknown chain "${s}" (known: ${CHAINS.map((x) => x.slug).join(', ')})`);
    return c;
  });
  const { maxStores, dryRun } = flags;
  log(`run ${runId}${dryRun ? ' (dry run)' : ''}${flags.offline ? ' (offline)' : ''} — chains: ${slugs.join(', ')}; cache: ${paths.root}`);
  // A dry run or an offline run reads the raw cache (re-parsing saved state), so it never thins it.
  if (flags.pruneRaw) pruneRaw(paths.raw, log);

  let mongo: MongoClient | null = null;
  let db: IngestDb | null = null;
  if (!dryRun) {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (put it in .env.shopping, or use --dry-run)');
    mongo = new MongoClient(process.env.MONGODB_URI);
    await mongo.connect();
    // The driver types `_id` as an ObjectId unless every collection is given a schema; ours are strings.
    db = mongo.db() as unknown as IngestDb;
  }

  try {
    const saved = readJson<Registry>(registryPath(paths.state), {});
    /** Why each official store is kept, for the run summary. */
    const why = new Map<string, KeepReason>();

    // 1. Fetch + parse the chains asked for (others keep their saved state).
    //    Each chain's stores are selected once, here (ingest/select.ts).
    const run = { rawDir: paths.raw, state, select, log, warn, maxStores };
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
    const snap = buildSnapshot({ stores, keys, state, cacheDir: paths.root, woltPhotos: photos, nowLocal, log });

    // 5. Size report (uncompressed BSON — what Atlas M0 counts).
    for (const line of sizeReport(snap, (doc) => BSON.calculateObjectSize(doc))) log(line);

    // 6. Diff + write.
    const written = readJson<Written>(writtenPath(paths.state), {});
    if (flags.full && db) await forgetWritten(db, written);
    const plan = planWrites(snap, written);
    for (const [name, d] of plan) log(`  diff ${name}: ${d.upserts.length} to write, ${d.deletes.length} to delete`);

    if (db) {
      await ensureIndexes(db);
      for (const [name, d] of plan) {
        await writeCollection(db, name, d.upserts, d.deletes, log);
        written[name] = d.next; // persisted per collection, so a crash mid-run only repeats the rest
        writeJson(writtenPath(paths.state), written);
      }
      await writeMeta(db, { at: new Date(), nowLocal, stores: snap.stores.size, items: snap.items.size, promos: snap.promos.size });
      writeJson(keysPath(paths.state), keys);
      // Local state changes only after Mongo has the matching docs, and never on a dry run.
      writeJson(registryPath(paths.state), registry);
      state.prune((id) => id in registry); // a store that left the target set
    }
    log(`done — log: ${logFile}`);
  } finally {
    await mongo?.close();
  }
}

main().catch((e) => {
  warn(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exitCode = 1;
});
