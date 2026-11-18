// A whole run of the ingest on a small cache built here, offline: no chain,
// Wolt, Nominatim or router request can be made (fetch is replaced by a
// counter that fails), and Mongo is a stand-in that records the writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { CanonItem } from '../shopping/normalize.ts';
import type { Pin } from '../shopping/places.ts';
import { cachePaths, ensureCacheDirs, runLog, type CachePaths } from '../shopping/ingest/cache.ts';
import { parseIngestFlags } from '../shopping/ingest/flags.ts';
import { loadPicks, type ReviewRow } from '../shopping/ingest/picks.ts';
import { runIngest } from '../shopping/ingest/run.ts';
import type { StoreRecord } from '../shopping/ingest/state.ts';
import type { IngestDb, WriteOp } from '../shopping/ingest/write.ts';

const YO = '7290803800003';
const KESHET = '7290785400000';
const SHUF = '7290027600007';

const home: Pin = { id: 'home', label: 'בית', lat: 32.08, lng: 34.78, city: 'tel-aviv', walkMinutes: 12 };
const near = { lat: 32.0831234, lng: 34.7812345 };
const row = (over: Partial<ReviewRow> & { id: string }): ReviewRow => ({
  name: over.id, names: [over.id], lat: 32.081, lng: 34.781, address: '', categories: [], sources: ['google'],
  refs: [over.id], distanceM: 100, status: 'none', retailer: null, official: null, decision: 'pending', ...over,
});
const item = (key: string, priceAgorot: number): CanonItem => ({
  key, code: key, barcode: false, name: 'חלב 3%', manufacturer: '', unitQty: '', quantity: null, unitOfMeasure: '', weighted: false, priceAgorot,
});
const rec = (chainId: string, chainSlug: string, id: string, over: Partial<StoreRecord> = {}): StoreRecord => ({
  chainId, storeId: id, subChainId: '', name: `סניף ${id}`, address: '', city: '0', kind: 'physical', chainSlug, chainName: chainSlug, cityId: 'tel-aviv', ...over,
});

/** The stores the last run saved, in registry order. */
const SAVED: StoreRecord[] = [
  rec(YO, 'yohananof', '32', { address: 'הרצל 1', at: { lat: 1, lng: 1 } }), // placed by its cached address, a 7-minute walk; the saved point is stale
  rec(YO, 'yohananof', '40', { cityId: 'beer-sheva' }), // included in the review (no pin in Beer Sheva)
  rec(YO, 'yohananof', '35', { address: 'ויצמן 12' }), // its address was never looked up
  rec(YO, 'yohananof', '54', { address: 'לא קיים 3' }), // a cached miss: can't be shown to be within the walk
  rec(KESHET, 'keshet', '104', { cityId: 'ramat-gan', address: 'ביאליק 39', keptAs: 'fallback' }), // the chain's only store
  rec(SHUF, 'shufersal', '413', { kind: 'online', cityId: null }), // on the chain's online list
  rec(SHUF, 'shufersal', '999', { kind: 'online', cityId: null }), // an online store that left the list
  rec('wolt', 'wolt', 'shop', { name: 'מכולת וולט', at: { lat: 32.0822, lng: 34.7822 } }),
  rec('manual', 'manual', 'abcdef0123', { name: 'ירקן', at: { lat: 32.0811, lng: 34.7811 } }),
];
const idOf = (s: StoreRecord) => `${s.chainId}:${s.storeId}`;

function cache(): CachePaths {
  const paths = cachePaths({ SHOPPING_CACHE_DIR: mkdtempSync(join(tmpdir(), 'hatom-run-')) });
  ensureCacheDirs(paths);
  mkdirSync(paths.places);
  const put = (dir: string, name: string, v: unknown, indent?: number) => writeFileSync(join(dir, name), JSON.stringify(v, null, indent));
  put(paths.places, 'pins.json', [home]);
  put(paths.places, 'home.review.json', [
    row({ id: 'G:bs', lat: 31.25, lng: 34.79, official: { chainSlug: 'yohananof', storeId: '40', name: '', address: '', cityId: 'beer-sheva' } }),
  ], 1);
  put(paths.places, 'decisions.json', { 'G:bs': 'include' });
  put(paths.places, 'wolt.json', [{ slug: 'shop', cityId: 'tel-aviv', placeId: 'G:wolt' }, { slug: 'market', cityId: 'tel-aviv', photosOnly: true }]);
  put(paths.places, 'geocode.json', {
    'הרצל 1 תל אביב': { p: near, at: '2026-01-01T00:00:00.000Z' },
    'לא קיים 3 תל אביב': { p: null, at: '2026-01-01T00:00:00.000Z' },
    'לא קיים תל אביב': { p: null, at: '2026-01-01T00:00:00.000Z' },
  }, 1);
  put(paths.places, 'walk.json', { [[home.lat, home.lng, near.lat, near.lng].map((n) => n.toFixed(5)).join(',')]: { s: 420, m: 500 } });
  put(paths.state, 'stores.json', Object.fromEntries(SAVED.map((s) => [idOf(s), s])));
  put(paths.state, 'keys.json', Object.fromEntries(SAVED.map((s, i) => [idOf(s), i + 1])));
  SAVED.forEach((s, i) => {
    const official = s.chainSlug !== 'wolt' && s.chainSlug !== 'manual';
    const state = {
      parser: 2, chainId: s.chainId, storeId: s.storeId, promoFile: null, promos: [],
      priceFile: s.chainSlug === 'manual' ? null : official ? `PriceFull${s.chainId}-000-${s.storeId.padStart(3, '0')}-20261117-0600.gz` : 'wolt-shop-202611170900',
      items: s.chainSlug === 'manual' ? [] : [item('X:milk', 500 + i), item(`${s.chainId}:own-${s.storeId}`, 100)],
    };
    writeFileSync(join(paths.storeState, `${idOf(s).replace(':', '-')}.json.gz`), gzipSync(JSON.stringify(state)));
  });
  return paths;
}

function memoryDb() {
  const batches: { name: string; ops: WriteOp[] }[] = [];
  const calls: string[] = [];
  const held: Record<string, Map<string, Record<string, unknown>>> = {};
  const db: IngestDb = {
    collection: (name) => ({
      createIndex: async (spec) => void calls.push(`createIndex ${name} ${JSON.stringify(spec)}`),
      dropIndex: async (index) => void calls.push(`dropIndex ${name} ${index}`),
      find: () => ({ toArray: async () => [...(held[name] ?? new Map()).values()] }),
      bulkWrite: async (ops) => {
        batches.push({ name, ops });
        const col = (held[name] ??= new Map());
        for (const op of ops) {
          if ('replaceOne' in op) col.set(op.replaceOne.filter._id, op.replaceOne.replacement);
          else col.delete(op.deleteOne.filter._id);
        }
      },
      replaceOne: async (filter, doc) => {
        calls.push(`replaceOne ${name} ${filter._id}`);
        (held[name] ??= new Map()).set(filter._id, { ...doc, _id: filter._id });
      },
    }),
  };
  const written = (name: string) => batches.filter((b) => b.name === name).flatMap((b) => b.ops);
  return { db, batches, calls, held, written };
}

/** Runs the ingest with every network request failing; returns what it did and how many it tried. */
async function run(paths: CachePaths, argv: string[], db: IngestDb | null) {
  const lines: string[] = [];
  const realFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw new Error('network request in an offline run');
  };
  try {
    const result = await runIngest({
      flags: parseIngestFlags(argv), paths, picks: loadPicks(paths.places), db,
      log: runLog(paths.logs, new Date(), { log: (m) => lines.push(m), warn: (m) => lines.push(m) }), // a warning arrives as "! …"
      sizeOf: (doc) => JSON.stringify(doc).length,
    });
    return { ...result, lines, requests };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const KEPT = [`${YO}:32`, `${YO}:40`, `${YO}:35`, `${KESHET}:104`, `${SHUF}:413`, 'wolt:shop', 'manual:abcdef0123'];

test('an --offline --dry-run rebuild: saved stores are selected again from the caches, with no request and nothing saved', async () => {
  const paths = cache();
  const before = Object.fromEntries(['stores.json', 'keys.json'].map((f) => [f, readFileSync(join(paths.state, f), 'utf8')]));
  const places = Object.fromEntries(readdirSync(paths.places).map((f) => [f, readFileSync(join(paths.places, f), 'utf8')]));
  const r = await run(paths, ['--offline', '--dry-run'], null);

  assert.equal(r.requests, 0);
  // One selection of the saved official stores; the Wolt venue and the manual shop stay as saved.
  assert.deepEqual(Object.keys(r.registry), KEPT);
  assert.deepEqual([...r.why], [
    [`${YO}:32`, 'near-pin'], [`${YO}:40`, 'included'], [`${YO}:35`, 'uncached'], [`${KESHET}:104`, 'fallback'], [`${SHUF}:413`, 'online'],
  ]);
  // loc is the point selection gave the record: derived again for official stores, the saved one for Wolt and manual.
  assert.deepEqual([...r.snapshot.stores.values()].map((s) => [s._id, s.k, s.loc]), [
    [`${YO}:32`, 1, { lat: 32.08312, lng: 34.78123 }],
    [`${YO}:40`, 2, { lat: 31.25, lng: 34.79 }],
    [`${YO}:35`, 3, null],
    [`${KESHET}:104`, 5, null],
    [`${SHUF}:413`, 6, null],
    ['wolt:shop', 8, { lat: 32.0822, lng: 34.7822 }],
    ['manual:abcdef0123', 9, { lat: 32.0811, lng: 34.7811 }],
  ]);
  assert.equal(r.registry[`${YO}:32`].at!.lat, near.lat);
  assert.equal(r.registry[`${KESHET}:104`].keptAs, 'fallback');
  // The dropped stores' prices are not in the docs; the kept ones' are, under their short keys.
  assert.deepEqual(r.snapshot.items.get('X:milk')!.p, { '1': 500, '2': 501, '3': 502, '5': 504, '6': 505, '8': 507 });
  assert.equal(r.snapshot.items.has(`${YO}:own-54`), false);
  assert.deepEqual(r.plan.map(([name, d]) => [name, d.upserts.length, d.deletes.length]), [
    ['shoppingChains', r.snapshot.chains.size, 0], ['shoppingStores', 7, 0], ['shoppingItems', 7, 0], ['shoppingPromos', 0, 0],
  ]);

  assert.ok(r.lines.includes(`! yohananof store 35 (סניף 35 / ויצמן 12): its address lookup is not in the cache; kept as saved`));
  assert.ok(r.lines.some((l) => /^! yohananof store 54 .*can't place it \(tried "לא קיים 3 תל אביב", "לא קיים תל אביב"\); left out$/.test(l)));
  assert.ok(r.lines.includes("  keshet 104 סניף 104: kept as the chain's only store"));
  assert.ok(r.lines.includes('saved stores of chains not fetched this run: kept 5 of 7: 1 included, 1 near a pin, 1 not in the cache, 1 online, 1 the chain\'s only store'));
  assert.ok(r.lines.includes("stores kept: 7 — 1 included, 1 near a pin, 1 not in the cache, 1 online, 1 the chain's only store, 1 Wolt venues, 1 manual shops"));
  assert.ok(r.lines.some((l) => l.startsWith('  market: photos not cached for week ')));

  // A dry run saves nothing: registry, keys, written hashes, store state, the owner's files and the caches.
  for (const [f, text] of Object.entries(before)) assert.equal(readFileSync(join(paths.state, f), 'utf8'), text, f);
  assert.equal(existsSync(join(paths.state, 'written.json')), false);
  assert.equal(readdirSync(paths.storeState).length, SAVED.length);
  for (const [f, text] of Object.entries(places)) assert.equal(readFileSync(join(paths.places, f), 'utf8'), text, f);
  assert.equal(readdirSync(paths.logs).length, 1);
});

test('an --offline run against Mongo: writes the docs, then saves the registry, keys and hashes; a second run writes nothing', async () => {
  const paths = cache();
  const mongo = memoryDb();
  const r = await run(paths, ['--offline'], mongo.db);

  assert.equal(r.requests, 0);
  assert.deepEqual(mongo.calls, ['createIndex shoppingPromos {"items":1}', 'createIndex shoppingItems {"d":1}', 'dropIndex shoppingStores city_1', 'replaceOne shoppingMeta ingest']);
  assert.deepEqual([...mongo.held.shoppingStores.keys()], KEPT);
  const store = mongo.held.shoppingStores.get(`${YO}:32`)!;
  assert.deepEqual(Object.keys(store).sort(), [
    '_id', 'address', 'chainId', 'chainName', 'chainSlug', 'city', 'k', 'kind', 'loc', 'name', 'priceFile', 'pricesAt', 'promoFile', 'promosAt', 'source', 'storeId',
  ]);
  assert.equal(store.pricesAt, '2026-11-17T06:00');
  assert.equal(mongo.held.shoppingItems.size, 7);
  assert.deepEqual(mongo.held.shoppingMeta.get('ingest'), { ...mongo.held.shoppingMeta.get('ingest'), _id: 'ingest', stores: 7, items: 7, promos: 0 });

  // Local state follows Mongo: the stores that left are gone from the registry and from the saved state.
  const registry = JSON.parse(readFileSync(join(paths.state, 'stores.json'), 'utf8')) as Record<string, StoreRecord>;
  assert.deepEqual(Object.keys(registry), KEPT);
  assert.deepEqual(registry[`${YO}:32`].at, near);
  assert.equal('at' in registry[`${YO}:35`], false);
  assert.deepEqual(readdirSync(paths.storeState).sort(), KEPT.map((id) => `${id.replace(':', '-')}.json.gz`).sort());
  const keys = JSON.parse(readFileSync(join(paths.state, 'keys.json'), 'utf8')) as Record<string, number>;
  assert.equal(keys[`${YO}:54`], 4); // a key is never reused, even once its store is gone
  const written = JSON.parse(readFileSync(join(paths.state, 'written.json'), 'utf8')) as Record<string, Record<string, string>>;
  assert.deepEqual(Object.keys(written.shoppingStores), KEPT);

  const again = await run(paths, ['--offline'], mongo.db);
  assert.equal(again.requests, 0);
  assert.deepEqual(again.plan.map(([, d]) => [d.upserts.length, d.deletes.length]), [[0, 0], [0, 0], [0, 0], [0, 0]]);
  assert.deepEqual(Object.keys(again.registry), KEPT);
  assert.equal(mongo.written('shoppingStores').length, 7); // nothing new

  // --full rewrites every doc Mongo holds.
  const full = await run(paths, ['--offline', '--full'], mongo.db);
  assert.deepEqual(full.plan.map(([, d]) => d.upserts.length), [full.snapshot.chains.size, 7, 7, 0]);
});

test('a run for an unknown chain stops before anything is fetched', async () => {
  await assert.rejects(run(cache(), ['--offline', '--dry-run', '--chains', 'nope'], null), /unknown chain "nope" \(known: yohananof, /);
});
