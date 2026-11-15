// Shopping price ingest — a local job you run by hand.
//
//   npm run shopping:ingest -- --dry-run                 # fetch + parse, print sizes, no DB
//   npm run shopping:ingest -- --chains yohananof         # one chain
//   npm run shopping:ingest -- --max-stores 2 --dry-run   # quick smoke run
//   npm run shopping:ingest -- --full                     # rewrite every doc (new machine / lost state)
//   npm run shopping:ingest -- --offline                  # no fetching: rebuild docs from saved state
//
// Needs MONGODB_URI (with write access) unless --dry-run. The npm script loads
// .env.shopping if present (gitignored via .env*).
//
// Cache: $SHOPPING_CACHE_DIR or ~/.cache/hatom-shopping
//   raw/<chain>/<file>        downloaded files, pruned after 7 days, never re-downloaded
//   state/stores/<chain>-<store>.json.gz   latest parsed items+promos per store
//   state/written.json        content hashes of what Mongo holds (drives the diff)
//   state/keys.json           store → short numeric key used in price maps
//   logs/<run>.log            skipped files / records

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { BSON, MongoClient, type AnyBulkWriteOperation, type Db, type Document } from 'mongodb';
import { CHAINS, chainBySlug, type ChainConfig } from '../chains.ts';
import { COLLECTIONS, SNAPSHOT_COLLECTIONS, storeId, type StoreId } from '../collections.ts';
import { CITIES, cityOf } from '../cities.ts';
import { decodeXmlBytes, isGzip } from '../xml.ts';
import { parsePriceFile, parsePromoFile, parseStoresFile, type CanonItem, type CanonPromo, type CanonStore } from '../normalize.ts';
import { buildItemDocs, buildPromoDocs, buildStoreDocs, diffDocs, israelLocalNow, type StoreState } from '../snapshot.ts';
import { Throttle, clientFor, errorMessage, type RemoteFile } from './sources.ts';

const RAW_RETENTION_DAYS = 7;
const REQUEST_GAP_MS = 1500;
const WRITE_BATCH = 500;
const WRITE_PAUSE_MS = 1000; // Atlas M0: ~100 ops/s; it queues rather than fails, but be polite.

const { values: args } = parseArgs({
  options: {
    chains: { type: 'string' },
    cities: { type: 'string' },
    'max-stores': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    full: { type: 'boolean', default: false },
    offline: { type: 'boolean', default: false },
  },
});

const CACHE = process.env.SHOPPING_CACHE_DIR || join(homedir(), '.cache', 'hatom-shopping');
const RAW = join(CACHE, 'raw');
const STATE = join(CACHE, 'state');
const STORE_STATE = join(STATE, 'stores');
const LOGS = join(CACHE, 'logs');
for (const d of [RAW, STORE_STATE, LOGS]) mkdirSync(d, { recursive: true });

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = join(LOGS, `${runId}.log`);
const log = (msg: string) => {
  console.log(msg);
  appendFileSync(logFile, msg + '\n');
};
const warn = (msg: string) => {
  console.warn(`! ${msg}`);
  appendFileSync(logFile, `WARN ${msg}\n`);
};

const readJson = <T,>(path: string, fallback: T): T => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback);
const writeJson = (path: string, v: unknown) => writeFileSync(path, JSON.stringify(v));

function pruneRaw() {
  const cutoff = Date.now() - RAW_RETENTION_DAYS * 86_400_000;
  let n = 0;
  for (const chain of readdirSync(RAW)) {
    for (const f of readdirSync(join(RAW, chain))) {
      const p = join(RAW, chain, f);
      if (statSync(p).mtimeMs < cutoff) {
        rmSync(p);
        n++;
      }
    }
  }
  if (n) log(`pruned ${n} raw files older than ${RAW_RETENTION_DAYS} days`);
}

/** Cached download: a file name we already have is never fetched again. */
async function fetchCached(chain: ChainConfig, file: RemoteFile, download: (f: RemoteFile) => Promise<Uint8Array>) {
  const dir = join(RAW, chain.slug);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, file.name);
  if (existsSync(path)) return new Uint8Array(readFileSync(path));
  const bytes = await download(file);
  writeFileSync(path, bytes);
  return bytes;
}

const toXml = (bytes: Uint8Array) => decodeXmlBytes(isGzip(bytes) ? new Uint8Array(gunzipSync(bytes)) : bytes);

/**
 * Bump when parsing/normalizing changes what lands in saved state. A saved
 * state from another version is re-parsed from the raw cache (or, if the raw
 * file was pruned, its file names are cleared so the next fetch re-parses).
 */
const PARSER_VERSION = 2;

interface SavedStoreState {
  parser?: number;
  chainId: string;
  storeId: string;
  priceFile: string | null;
  promoFile: string | null;
  items: CanonItem[];
  promos: CanonPromo[];
}

// File name is the StoreId with ':' → '-' (chain ids are digits, so the first '-' splits them back).
const statePath = (id: StoreId) => join(STORE_STATE, `${id.replace(':', '-')}.json.gz`);
const stateFileId = (file: string) => file.replace(/\.json\.gz$/, '').replace('-', ':') as StoreId;
const saveState = (s: SavedStoreState) =>
  writeFileSync(statePath(storeId(s)), gzipSync(JSON.stringify({ ...s, parser: PARSER_VERSION })));

function loadState(store: { chainId: string; storeId: string; chainSlug: string }): SavedStoreState | null {
  const p = statePath(storeId(store));
  if (!existsSync(p)) return null;
  const st = JSON.parse(gunzipSync(readFileSync(p)).toString('utf8')) as SavedStoreState;
  if (st.parser === PARSER_VERSION) return st;
  const raw = (file: string | null) => (file ? join(RAW, store.chainSlug, file) : null);
  const priceRaw = raw(st.priceFile);
  const promoRaw = raw(st.promoFile);
  if (priceRaw && existsSync(priceRaw)) st.items = parsePriceFile(toXml(new Uint8Array(readFileSync(priceRaw)))).items;
  else st.priceFile = null;
  if (promoRaw && existsSync(promoRaw)) st.promos = parsePromoFile(toXml(new Uint8Array(readFileSync(promoRaw)))).promos;
  else st.promoFile = null;
  saveState(st);
  log(`  re-parsed saved state of ${storeId(store)} (parser v${st.parser ?? 1} → v${PARSER_VERSION})`);
  return st;
}

interface StoreRecord extends CanonStore {
  chainSlug: string;
  chainName: string;
  /** Target city id; null for an online store outside the target cities. */
  cityId: string | null;
}

async function ingestChain(chain: ChainConfig, cityIds: Set<string>, maxStores: number | null): Promise<StoreRecord[]> {
  const client = clientFor(chain, new Throttle(REQUEST_GAP_MS));
  const storesFile = await client.latestStores();
  if (!storesFile) throw new Error(`${chain.slug}: no Stores file listed`);
  const parsed = parseStoresFile(toXml(await fetchCached(chain, storesFile, (f) => client.download(f))));
  let targets: StoreRecord[] = parsed.stores
    .map((s) => ({ ...s, chainSlug: chain.slug, chainName: chain.name, cityId: cityOf(s) }))
    // Online stores are kept whatever their city and listed separately (kind: 'online').
    .filter((s) => s.kind === 'online' || (s.cityId !== null && cityIds.has(s.cityId)));
  if (maxStores !== null) targets = targets.slice(0, maxStores);
  log(`${chain.slug}: ${parsed.stores.length} stores listed, ${targets.length} in target cities or online (${storesFile.name})`);

  const ids = targets.map((s) => s.storeId);
  const [prices, promos] = [await client.latestFor('PriceFull', ids), await client.latestFor('PromoFull', ids)];

  for (const s of targets) {
    const prev = loadState(s);
    const priceFile = prices.get(s.storeId) ?? null;
    const promoFile = promos.get(s.storeId) ?? null;
    if (!priceFile) warn(`${chain.slug} store ${s.storeId} (${s.name}): no PriceFull listed — keeping previous prices`);
    if (!promoFile) warn(`${chain.slug} store ${s.storeId} (${s.name}): no PromoFull listed — keeping previous promos`);
    const next: SavedStoreState = prev ?? { chainId: chain.chainId, storeId: s.storeId, priceFile: null, promoFile: null, items: [], promos: [] };
    try {
      if (priceFile && priceFile.name !== next.priceFile) {
        const r = parsePriceFile(toXml(await fetchCached(chain, priceFile, (f) => client.download(f))));
        if (r.storeId !== s.storeId) warn(`${priceFile.name}: header store ${r.storeId} ≠ listed ${s.storeId}`);
        if (r.skipped) warn(`${priceFile.name}: skipped ${r.skipped} item records (no code / no price)`);
        if (!r.items.length) throw new Error(`${priceFile.name}: no items parsed`);
        next.items = r.items;
        next.priceFile = priceFile.name;
      }
      if (promoFile && promoFile.name !== next.promoFile) {
        const r = parsePromoFile(toXml(await fetchCached(chain, promoFile, (f) => client.download(f))));
        if (r.skipped) warn(`${promoFile.name}: skipped ${r.skipped} promotion records`);
        next.promos = r.promos;
        next.promoFile = promoFile.name;
      }
    } catch (e) {
      warn(`${chain.slug} store ${s.storeId}: skipped file — ${errorMessage(e)}`);
    }
    saveState(next);
    log(`  ${s.storeId.padStart(4)} ${(s.cityId ?? s.kind).padEnd(10)} ${s.name} — ${next.items.length} items, ${next.promos.length} promos`);
  }
  return targets;
}

function assignKeys(stores: StoreRecord[], existing: Record<string, number>): Record<string, number> {
  const keys = { ...existing };
  let max = Math.max(0, ...Object.values(keys));
  for (const s of stores) {
    const id = storeId(s);
    if (!(id in keys)) keys[id] = ++max;
  }
  return keys;
}

type StringIdDoc = Document & { _id: string };

async function writeCollection(db: Db, name: string, upserts: StringIdDoc[], deletes: string[]) {
  const col = db.collection<StringIdDoc>(name);
  const ops: AnyBulkWriteOperation<StringIdDoc>[] = [
    ...upserts.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })),
    ...deletes.map((id) => ({ deleteOne: { filter: { _id: id } } })),
  ];
  for (let i = 0; i < ops.length; i += WRITE_BATCH) {
    await col.bulkWrite(ops.slice(i, i + WRITE_BATCH), { ordered: false });
    if (i + WRITE_BATCH < ops.length) await new Promise((r) => setTimeout(r, WRITE_PAUSE_MS));
  }
  log(`  ${name}: ${upserts.length} upserted, ${deletes.length} deleted`);
}

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

async function main() {
  const slugs = args.chains ? args.chains.split(',') : CHAINS.map((c) => c.slug);
  const chains = slugs.map((s) => {
    const c = chainBySlug(s.trim());
    if (!c) throw new Error(`unknown chain "${s}" (known: ${CHAINS.map((x) => x.slug).join(', ')})`);
    return c;
  });
  const cityIds = new Set(args.cities ? args.cities.split(',') : CITIES.map((c) => c.id));
  const maxStores = args['max-stores'] ? Number(args['max-stores']) : null;
  const dry = args['dry-run'];
  log(`run ${runId}${dry ? ' (dry run)' : ''}${args.offline ? ' (offline)' : ''} — chains: ${slugs.join(', ')}; cache: ${CACHE}`);
  pruneRaw();

  let mongo: MongoClient | null = null;
  let db: Db | null = null;
  if (!dry) {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (put it in .env.shopping, or use --dry-run)');
    mongo = new MongoClient(process.env.MONGODB_URI);
    await mongo.connect();
    db = mongo.db();
  }

  try {
    // 1. Fetch + parse the chains asked for (others keep their saved state).
    const fresh: StoreRecord[] = [];
    for (const chain of args.offline ? [] : chains) {
      try {
        fresh.push(...(await ingestChain(chain, cityIds, maxStores)));
      } catch (e) {
        warn(`${chain.slug}: chain skipped — ${errorMessage(e)}`);
      }
    }

    // 2. Store registry: merge with stores of chains not run this time. A
    //    complete run of a chain replaces its store list; a --max-stores run
    //    only adds/updates, so it never makes a later run delete stores.
    const registryPath = join(STATE, 'stores.json');
    const registry = readJson<Record<string, StoreRecord>>(registryPath, {});
    if (maxStores === null) {
      const ranChainIds = new Set(fresh.map((s) => s.chainId));
      for (const id of Object.keys(registry)) {
        if (ranChainIds.has(registry[id].chainId)) delete registry[id];
      }
    }
    for (const s of fresh) registry[storeId(s)] = s;

    // 3. Short store keys — Mongo is the authority when we have it.
    const keysPath = join(STATE, 'keys.json');
    let existingKeys = readJson<Record<string, number>>(keysPath, {});
    if (db) {
      const docs = await db.collection(COLLECTIONS.stores).find({}, { projection: { k: 1 } }).toArray();
      if (docs.length) existingKeys = Object.fromEntries(docs.map((d) => [String(d._id), d.k as number]));
    }
    const keys = assignKeys(Object.values(registry), existingKeys);

    // 4. Desired documents (each store's saved state is read once).
    const loaded = Object.values(registry).map((s) => ({ s, st: loadState(s) }));
    const states: StoreState[] = loaded.flatMap(({ s, st }) =>
      st ? [{ k: keys[storeId(s)], chainId: s.chainId, storeId: s.storeId, items: st.items, promos: st.promos }] : [],
    );
    const nowLocal = israelLocalNow();
    const items = buildItemDocs(states);
    const promoStats = { droppedCoupons: 0 };
    const promos = buildPromoDocs(states, nowLocal, promoStats);
    const storeDocs = buildStoreDocs(
      loaded.map(({ s, st }) => ({ ...s, priceFile: st?.priceFile ?? null, promoFile: st?.promoFile ?? null })),
      keys,
    );
    const chainDocs = new Map(CHAINS.map((c) => [c.chainId, { _id: c.chainId, slug: c.slug, name: c.name }]));

    // 5. Size report (uncompressed BSON — what Atlas M0 counts).
    const size = (m: Map<string, Document>) => {
      let n = 0;
      for (const d of m.values()) n += BSON.calculateObjectSize(d);
      return n;
    };
    const priceEntries = [...items.values()].reduce((n, d) => n + Object.keys(d.p).length, 0);
    const promoItemEntries = [...promos.values()].reduce((n, d) => n + d.items.length, 0);
    log(`snapshot: ${storeDocs.size} stores, ${items.size} items (${priceEntries} store prices), ${promos.size} live promos (${promoItemEntries} promo-item links); dropped ${promoStats.droppedCoupons} store copies of coupons with no numeric discount`);
    log(`  BSON: items ${mb(size(items))}, promos ${mb(size(promos))}, stores ${mb(size(storeDocs))}`);
    log(`  index estimate: promos.items multikey ≈ ${mb(promoItemEntries * 40)}, _id indexes ≈ ${mb((items.size + promos.size) * 40)}`);

    // 6. Diff + write.
    const writtenPath = join(STATE, 'written.json');
    const written = readJson<Record<string, Record<string, string>>>(writtenPath, {});
    if (args.full && db) {
      for (const name of SNAPSHOT_COLLECTIONS) {
        const ids = await db.collection(name).find({}, { projection: { _id: 1 } }).map((d) => String(d._id)).toArray();
        written[name] = Object.fromEntries(ids.map((id) => [id, '']));
      }
    }
    const plan = [
      [COLLECTIONS.chains, diffDocs(chainDocs, written[COLLECTIONS.chains] ?? {})],
      [COLLECTIONS.stores, diffDocs(storeDocs, written[COLLECTIONS.stores] ?? {})],
      [COLLECTIONS.items, diffDocs(items, written[COLLECTIONS.items] ?? {})],
      [COLLECTIONS.promos, diffDocs(promos, written[COLLECTIONS.promos] ?? {})],
    ] as const;
    for (const [name, d] of plan) log(`  diff ${name}: ${d.upserts.length} to write, ${d.deletes.length} to delete`);

    if (db) {
      await db.collection(COLLECTIONS.promos).createIndex({ items: 1 });
      await db.collection(COLLECTIONS.stores).createIndex({ city: 1 });
      for (const [name, d] of plan) {
        await writeCollection(db, name, d.upserts as StringIdDoc[], d.deletes);
        written[name] = d.next; // persisted per collection, so a crash mid-run only repeats the rest
        writeJson(writtenPath, written);
      }
      await db.collection<StringIdDoc>(COLLECTIONS.meta).replaceOne(
        { _id: 'ingest' },
        { at: new Date(), nowLocal, stores: storeDocs.size, items: items.size, promos: promos.size },
        { upsert: true },
      );
      writeJson(keysPath, keys);
      // Local state changes only after Mongo has the matching docs, and never on a dry run.
      writeJson(registryPath, registry);
      for (const f of readdirSync(STORE_STATE)) {
        if (!registry[stateFileId(f)]) rmSync(join(STORE_STATE, f)); // store left the target set
      }
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
