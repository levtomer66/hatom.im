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
// This file is the entry point: it reads the flags (flags.ts) and the
// environment, opens Mongo and hands them to the run (run.ts). It is the only
// ingest module with top-level side effects; the rules live in the stages:
//   picks.ts   the owner's files            select.ts  which stores are kept
//   locate.ts  where a store is             official.ts / wolt.ts  one chain's run
//   state.ts   what is saved between runs   build.ts   saved state → documents
//   write.ts   documents → Mongo            run.ts     the stages in order, the summary

import { BSON, MongoClient } from 'mongodb';
import { cachePaths, ensureCacheDirs, runLog } from './cache.ts';
import { parseIngestFlags, type IngestFlags } from './flags.ts';
import { loadPicks, type Picks } from './picks.ts';
import { runIngest } from './run.ts';
import { errorMessage } from './sources.ts';
import type { IngestDb } from './write.ts';

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
const log = runLog(paths.logs);

async function main() {
  let mongo: MongoClient | null = null;
  let db: IngestDb | null = null;
  if (!flags.dryRun) {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (put it in .env.shopping, or use --dry-run)');
    mongo = new MongoClient(process.env.MONGODB_URI);
    await mongo.connect();
    // The driver types `_id` as an ObjectId unless every collection is given a schema; ours are strings.
    db = mongo.db() as unknown as IngestDb;
  }
  try {
    await runIngest({ flags, paths, picks, log, db, sizeOf: (doc) => BSON.calculateObjectSize(doc) });
  } finally {
    await mongo?.close();
  }
}

main().catch((e) => {
  log.warn(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exitCode = 1;
});
