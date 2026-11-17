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

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { BSON, MongoClient, type AnyBulkWriteOperation, type Db, type Document } from 'mongodb';
import { CHAINS, chainBySlug, keepOnlineStore, type ChainConfig } from '../chains.ts';
import { COLLECTIONS, SNAPSHOT_COLLECTIONS, storeId, type StoreId } from '../collections.ts';
import { CITIES, cityOf } from '../cities.ts';
import { decodeXmlBytes, isGzip } from '../xml.ts';
import { parsePriceFile, parsePromoFile, parseStoresFile, type CanonItem, type CanonPromo, type CanonStore } from '../normalize.ts';
import { buildItemDocs, buildPromoDocs, buildStoreDocs, diffDocs, israelLocalNow, type StoreState } from '../snapshot.ts';
import { Throttle, clientFor, errorMessage, type RemoteFile } from './sources.ts';
import { fetchWoltVenue, type WoltVenueConfig } from './wolt.ts';
import { pinFilter } from './locate.ts';
import { RAMI_LEVY_IMG, cachedPhotos, readRamiLevy } from './off.ts';

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
    /** Ignore places/pins.json and keep every store in the target cities. */
    'all-stores': { type: 'boolean', default: false },
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
// With pins, only stores near them are ingested (ingest/locate.ts); --all-stores keeps whole cities.
const PINS = args['all-stores'] ? null : pinFilter(join(CACHE, 'places'));

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
  // Wolt state has no price file to re-parse from; its items are rebuilt by the next fetch.
  if (st.parser === PARSER_VERSION || store.chainSlug === 'wolt' || store.chainSlug === 'manual') return st;
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
  /** Map point, when the source places it (discovery review rows); official stores are placed by the pin filter. */
  at?: { lat: number; lng: number };
}

async function ingestChain(chain: ChainConfig, cityIds: Set<string>, maxStores: number | null): Promise<StoreRecord[]> {
  if (chain.source.kind === 'wolt') return ingestWolt(chain, cityIds, maxStores);
  if (chain.source.kind === 'manual') return ingestManual(chain, cityIds);
  const client = clientFor(chain, new Throttle(REQUEST_GAP_MS));
  const storesFile = await client.latestStores();
  if (!storesFile) throw new Error(`${chain.slug}: no Stores file listed`);
  const parsed = parseStoresFile(toXml(await fetchCached(chain, storesFile, (f) => client.download(f))));
  const seen = new Set<string>(); // some Stores files list a store more than once
  let targets: StoreRecord[] = parsed.stores
    .filter((s) => !seen.has(s.storeId) && !!seen.add(s.storeId))
    .map((s) => ({ ...s, chainSlug: chain.slug, chainName: chain.name, cityId: cityOf(s) }))
    // Online stores are listed separately (kind: 'online'): those serving the target cities (chains.ts).
    .filter((s) => (s.kind === 'online' ? keepOnlineStore(chain, s.storeId, s.cityId) : s.cityId !== null && cityIds.has(s.cityId)));
  if (PINS) {
    const near = await PINS.keep(targets, warn);
    const before = targets.length;
    targets = targets.filter((s) => near.has(storeId(s)));
    log(`${chain.slug}: ${targets.length} of ${before} target-city stores are near a pin or online`);
  }
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

/**
 * Wolt venues approved in places/wolt.json. A venue that fails to load keeps
 * its previous items, like a chain store whose PriceFull is missing.
 */
async function ingestWolt(chain: ChainConfig, cityIds: Set<string>, maxStores: number | null): Promise<StoreRecord[]> {
  const configPath = join(CACHE, 'places', 'wolt.json');
  let venues = readJson<WoltVenueConfig[]>(configPath, []).filter((v) => cityIds.has(v.cityId) && !v.photosOnly);
  if (PINS) {
    // Wolt pages carry no coordinates; a venue is placed by the discovery entry it was approved from.
    const at = placeCoords();
    const kept: WoltVenueConfig[] = [];
    for (const v of venues) {
      const p = v.placeId ? at.get(v.placeId) : undefined;
      if (p && (await PINS.near(v.cityId, p))) kept.push(v);
      else log(`  ${v.slug}: ${p ? 'outside the pin' : 'no discovery entry to place it'} — left out`);
    }
    venues = kept;
  }
  if (maxStores !== null) venues = venues.slice(0, maxStores);
  log(`${chain.slug}: ${venues.length} venues in target cities (${existsSync(configPath) ? configPath : 'no places/wolt.json'})`);
  const rawDir = join(RAW, chain.slug);
  mkdirSync(rawDir, { recursive: true });
  const nowLocal = israelLocalNow(); // "YYYY-MM-DDTHH:mm"
  const day = nowLocal.slice(0, 10).replace(/-/g, '');
  const throttle = new Throttle(REQUEST_GAP_MS);
  const previous = readJson<Record<string, StoreRecord>>(join(STATE, 'stores.json'), {});
  const out: StoreRecord[] = [];
  for (const v of venues) {
    const at = v.placeId ? placeCoords().get(v.placeId) : undefined;
    const rec: StoreRecord = {
      chainId: chain.chainId, storeId: v.slug, subChainId: '', name: v.slug, address: '', city: v.cityId, kind: 'physical',
      chainSlug: chain.slug, chainName: chain.name, cityId: v.cityId, ...(at ? { at } : {}),
    };
    const prev = loadState(rec);
    const next: SavedStoreState = prev ?? { chainId: chain.chainId, storeId: v.slug, priceFile: null, promoFile: null, items: [], promos: [] };
    try {
      const venue = await fetchWoltVenue(v.slug, rawDir, day, throttle);
      rec.name = venue.name;
      rec.address = venue.address;
      if (!venue.items.length) throw new Error('no items');
      next.items = venue.items;
      // Same day = same cached responses, so the stamp only moves when the data can have.
      next.priceFile = venue.fetched || !prev?.priceFile ? `wolt-${v.slug}-${nowLocal.replace(/[-T:]/g, '')}` : prev.priceFile;
      const withBarcode = venue.items.filter((i) => i.barcode).length;
      log(`  ${v.slug.padEnd(30)} ${venue.name} — ${venue.items.length} items (${withBarcode} with barcode), ${venue.fetched} requests`);
    } catch (e) {
      warn(`${chain.slug} venue ${v.slug}: ${errorMessage(e)} — keeping previous items`);
      const old = previous[storeId(rec)];
      if (old) Object.assign(rec, { name: old.name, address: old.address });
    }
    saveState(next);
    out.push(rec);
  }
  return out;
}

/**
 * Shops the owner marked "include" in the discovery review (places/decisions.json)
 * that have no ingested price source: not an official store we fetch, and not a
 * Wolt venue in places/wolt.json. They are listed with no items; users type
 * their prices in the app (shoppingManualPrices). Store id = hash of the
 * discovery place id, so it is stable across runs. The decisions are the
 * owner's curated list (checked against the walk limit when it was made), so
 * they are not re-checked here: two routers disagree by a minute at the edge.
 */
/** Discovery place ref → coordinates, from every pin's review file. */
/**
 * barcode → photo link from the photo-only Wolt venues (places/wolt.json
 * `photosOnly`). Their responses are cached under the week's Sunday, so a
 * venue is downloaded at most once a week; --offline only reads that cache.
 */
async function woltPhotos(offline: boolean): Promise<Map<string, string>> {
  const venues = readJson<WoltVenueConfig[]>(join(CACHE, 'places', 'wolt.json'), []).filter((v) => v.photosOnly);
  const out = new Map<string, string>();
  if (!venues.length) return out;
  const rawDir = join(RAW, 'wolt');
  mkdirSync(rawDir, { recursive: true });
  const now = new Date(`${israelLocalNow().slice(0, 10)}T00:00:00Z`);
  const week = new Date(now.getTime() - now.getUTCDay() * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');
  const throttle = new Throttle(REQUEST_GAP_MS);
  for (const v of venues) {
    if (offline && !existsSync(join(rawDir, `${v.slug}-${week}-assortment.json`))) {
      log(`  ${v.slug}: photos not cached for week ${week} — skipped (--offline)`);
      continue;
    }
    try {
      const venue = await fetchWoltVenue(v.slug, rawDir, week, throttle);
      let n = 0;
      for (const it of venue.items) {
        if (!it.barcode || !it.img || out.has(it.key)) continue;
        out.set(it.key, it.img);
        n++;
      }
      log(`  ${v.slug.padEnd(30)} ${venue.name} — photos for ${n} barcodes (${venue.fetched} requests)`);
    } catch (e) {
      warn(`photo venue ${v.slug}: ${errorMessage(e)}`);
    }
  }
  return out;
}

function placeCoords(): Map<string, { lat: number; lng: number }> {
  const out = new Map<string, { lat: number; lng: number }>();
  for (const pin of readJson<{ id: string }[]>(join(CACHE, 'places', 'pins.json'), [])) {
    for (const r of readJson<{ refs: string[]; lat: number; lng: number }[]>(join(CACHE, 'places', `${pin.id}.review.json`), [])) {
      for (const ref of r.refs) out.set(ref, { lat: r.lat, lng: r.lng });
    }
  }
  return out;
}

function ingestManual(chain: ChainConfig, cityIds: Set<string>): StoreRecord[] {
  const places = join(CACHE, 'places');
  const decisions = readJson<Record<string, string>>(join(places, 'decisions.json'), {});
  const pins = readJson<{ id: string; city: string }[]>(join(places, 'pins.json'), []);
  // A venue with `manualToo` sells only part of the shop on Wolt (e.g. just produce): keep the manual shop too.
  const woltPlaces = new Set(readJson<WoltVenueConfig[]>(join(places, 'wolt.json'), []).filter((v) => !v.manualToo).map((v) => v.placeId).filter(Boolean));
  const out = new Map<string, StoreRecord>();
  for (const pin of pins.filter((p) => cityIds.has(p.city))) {
    type Row = { id: string; name: string; address: string; refs: string[]; status: string; lat: number; lng: number };
    for (const r of readJson<Row[]>(join(places, `${pin.id}.review.json`), [])) {
      if (r.status === 'ingested' || !r.refs.some((ref) => decisions[ref] === 'include')) continue;
      if (r.refs.some((ref) => woltPlaces.has(ref))) continue;
      const id = createHash('sha1').update(r.id).digest('hex').slice(0, 10);
      out.set(id, {
        chainId: chain.chainId, storeId: id, subChainId: '', name: r.name, address: r.address, city: pin.city, kind: 'physical',
        chainSlug: chain.slug, chainName: chain.name, cityId: pin.city, at: { lat: r.lat, lng: r.lng },
      });
    }
  }
  for (const rec of out.values()) {
    if (!loadState(rec)) saveState({ chainId: chain.chainId, storeId: rec.storeId, priceFile: null, promoFile: null, items: [], promos: [] });
  }
  log(`${chain.slug}: ${out.size} included shops with no price source (from places/decisions.json)`);
  return [...out.values()];
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
    // Online stores left from before the per-chain list (chains.ts onlineStores).
    for (const s of Object.values(registry)) {
      if (s.kind === 'online' && !keepOnlineStore(chainBySlug(s.chainSlug), s.storeId, s.cityId)) delete registry[storeId(s)];
    }
    // Stores of chains not run this time (or an --offline run) are held to the pins too.
    if (PINS) {
      const others = Object.values(registry).filter((s) => s.chainSlug !== 'wolt' && s.chainSlug !== 'manual');
      const near = await PINS.keep(others, warn);
      for (const s of others) if (!near.has(storeId(s))) delete registry[storeId(s)];
    }

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
    // Photos by barcode for items no priced source photographs: Rami Levy's CDN,
    // then a photo-only Wolt venue, then Open Food Facts (caches filled by
    // `npm run shopping:photos`; the ingest never fetches them).
    const photos = cachedPhotos(CACHE);
    // Rami Levy's CDN has a photo for 99.4% of the barcodes Rami Levy sells (checked
    // 2026-11-17), so those get its link before they're checked; a checked miss wins.
    const probed = readRamiLevy(CACHE);
    const ramiLevy = chainBySlug('rami-levy')!.chainId;
    for (const st of states) {
      if (st.chainId !== ramiLevy) continue;
      for (const it of st.items) {
        if (it.barcode && /^\d{8,14}$/.test(it.key) && !(it.key in probed) && !photos.has(it.key)) photos.set(it.key, { img: RAMI_LEVY_IMG(it.key) });
      }
    }
    const wm = await woltPhotos(Boolean(args.offline));
    for (const [k, img] of wm) if (!photos.get(k) || photos.get(k)!.by === 'off') photos.set(k, { img });
    log(`photos by barcode: ${photos.size} (Rami Levy + Open Food Facts cache, ${wm.size} from photo-only Wolt venues)`);
    const items = buildItemDocs(states, photos);
    const promoStats = { droppedCoupons: 0 };
    const promos = buildPromoDocs(states, nowLocal, promoStats);
    // Walking minutes from the nearest pin, for the plan cards (null when unplaced or with no pins).
    const walk = new Map<string, number | null>();
    if (PINS) {
      for (const { s } of loaded) {
        if (s.kind !== 'physical') continue;
        const at = s.at ?? (await PINS.pointOf(s));
        walk.set(storeId(s), at ? await PINS.walkMinutes(s.cityId, at) : null);
      }
    }
    const storeDocs = buildStoreDocs(
      loaded.map(({ s, st }) => ({ ...s, priceFile: st?.priceFile ?? null, promoFile: st?.promoFile ?? null, walkMin: walk.get(storeId(s)) ?? null })),
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
      // In-store "לא היה": alternatives in the same department (app's /api/shopping/alternatives).
      await db.collection(COLLECTIONS.items).createIndex({ d: 1 }, { sparse: true });
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
