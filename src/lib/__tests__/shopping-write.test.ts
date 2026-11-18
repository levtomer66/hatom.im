import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WRITE_BATCH, WRITE_PAUSE_MS, ensureIndexes, forgetWritten, mongoStoreKeys, planWrites, writeCollection, writeMeta,
  type IndexDb, type IngestDb, type WriteOp, type Written,
} from '../shopping/ingest/write.ts';
import { docHash } from '../shopping/snapshot.ts';

/** A stand-in for the Mongo driver's Db: records the index calls. */
function fakeDb(dropError?: Error) {
  const calls: string[] = [];
  const db: IndexDb = {
    collection: (name) => ({
      createIndex: async (spec, options) => {
        calls.push(`create ${name} ${JSON.stringify(spec)}${options ? ` ${JSON.stringify(options)}` : ''}`);
        return 'ok';
      },
      dropIndex: async (indexName) => {
        calls.push(`drop ${name} ${indexName}`);
        if (dropError) throw dropError;
        return {};
      },
    }),
  };
  return { db, calls };
}

test('ensureIndexes: the promo and department indexes; the stores city index is dropped, not created', async () => {
  const { db, calls } = fakeDb();
  await ensureIndexes(db);
  assert.deepEqual(calls.sort(), [
    'create shoppingItems {"d":1} {"sparse":true}',
    'create shoppingPromos {"items":1}',
    'drop shoppingStores city_1',
  ]);
});

test('ensureIndexes: a city index that is already gone is not an error', async () => {
  for (const err of [
    Object.assign(new Error('index not found with name [city_1]'), { code: 27, codeName: 'IndexNotFound' }),
    Object.assign(new Error('ns not found'), { code: 26, codeName: 'NamespaceNotFound' }), // a new database: no stores collection yet
  ]) {
    const { db } = fakeDb(err);
    await ensureIndexes(db);
  }
});

test('ensureIndexes: any other failure to drop the index is raised', async () => {
  const { db } = fakeDb(Object.assign(new Error('not authorized'), { code: 13, codeName: 'Unauthorized' }));
  await assert.rejects(ensureIndexes(db), /not authorized/);
});

// ── reads and writes, against a stand-in for the driver's Db ──────────────

function memoryDb(held: Record<string, Record<string, unknown>[]> = {}) {
  const batches: { name: string; ops: WriteOp[]; ordered: boolean }[] = [];
  const replaced: { name: string; filter: object; doc: object; upsert: boolean }[] = [];
  const db: Pick<IngestDb, 'collection'> = {
    collection: (name) => ({
      createIndex: async () => 'ok',
      dropIndex: async () => ({}),
      find: (_filter, options) => ({
        toArray: async () => (held[name] ?? []).map((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k === '_id' || k in options.projection))),
      }),
      bulkWrite: async (ops, options) => void batches.push({ name, ops, ordered: options.ordered }),
      replaceOne: async (filter, doc, options) => void replaced.push({ name, filter, doc, upsert: options.upsert }),
    }),
  };
  return { db, batches, replaced };
}

test('mongoStoreKeys: the keys Mongo holds, or null when it has no stores yet', async () => {
  const { db } = memoryDb({ shoppingStores: [{ _id: '7290803800003:40', k: 3, name: 'x' }, { _id: 'wolt:v', k: 12 }] });
  assert.deepEqual(await mongoStoreKeys(db), { '7290803800003:40': 3, 'wolt:v': 12 });
  assert.equal(await mongoStoreKeys(memoryDb().db), null);
});

test('planWrites: only docs whose content changed are written; docs no longer built are deleted', () => {
  const doc = (id: string, v: number) => ({ _id: id, v });
  const written: Written = {
    shoppingItems: { a: docHash(doc('a', 1)), b: docHash(doc('b', 1)), gone: 'x' },
    shoppingStores: { s: docHash(doc('s', 1)) },
  };
  const plan = planWrites({
    chains: new Map([['c', doc('c', 1)]]),
    stores: new Map([['s', doc('s', 1)]]),
    items: new Map([['a', doc('a', 1)], ['b', doc('b', 2)], ['n', doc('n', 1)]]),
    promos: new Map(),
  }, written);
  assert.deepEqual(plan.map(([name, d]) => [name, d.upserts.map((x) => x._id), d.deletes]), [
    ['shoppingChains', ['c'], []],
    ['shoppingStores', [], []],
    ['shoppingItems', ['b', 'n'], ['gone']],
    ['shoppingPromos', [], []],
  ]);
  assert.deepEqual(Object.keys(plan[2][1].next), ['a', 'b', 'n']);
});

test('forgetWritten (--full): every doc Mongo holds is rewritten or deleted', async () => {
  const { db } = memoryDb({ shoppingItems: [{ _id: 'a', n: 'x' }, { _id: 'stale' }], shoppingChains: [{ _id: 'c' }] });
  const written: Written = { shoppingItems: { a: 'hash-a' }, shoppingPromos: { p: 'hash-p' } };
  await forgetWritten(db, written);
  assert.deepEqual(written, { shoppingChains: { c: '' }, shoppingStores: {}, shoppingItems: { a: '', stale: '' }, shoppingPromos: {} });
  const plan = planWrites({ chains: new Map(), stores: new Map(), items: new Map([['a', { _id: 'a' }]]), promos: new Map() }, written);
  assert.deepEqual(plan[2][1].upserts, [{ _id: 'a' }]);
  assert.deepEqual(plan[2][1].deletes, ['stale']);
});

test('writeCollection: unordered batches of 500 with a pause between them', async () => {
  const { db, batches } = memoryDb();
  const pauses: number[] = [];
  const lines: string[] = [];
  const upserts = Array.from({ length: 1200 }, (_, i) => ({ _id: `i${i}`, n: i }));
  await writeCollection(db, 'shoppingItems', upserts, ['x', 'y', 'z'], (m) => lines.push(m), async (ms) => void pauses.push(ms));
  assert.equal(WRITE_BATCH, 500);
  assert.deepEqual(batches.map((b) => [b.name, b.ops.length, b.ordered]), [['shoppingItems', 500, false], ['shoppingItems', 500, false], ['shoppingItems', 203, false]]);
  assert.deepEqual(pauses, [WRITE_PAUSE_MS, WRITE_PAUSE_MS]);
  assert.deepEqual(batches[0].ops[0], { replaceOne: { filter: { _id: 'i0' }, replacement: { _id: 'i0', n: 0 }, upsert: true } });
  assert.deepEqual(batches[2].ops.at(-1), { deleteOne: { filter: { _id: 'z' } } });
  assert.deepEqual(lines, ['  shoppingItems: 1200 upserted, 3 deleted']);
  // Nothing to write: no call at all.
  await writeCollection(db, 'shoppingPromos', [], [], () => {}, async () => {});
  assert.equal(batches.length, 3);
});

test('writeMeta: the one "ingest" doc of shoppingMeta', async () => {
  const { db, replaced } = memoryDb();
  const meta = { at: new Date('2026-11-18T10:00:00Z'), nowLocal: '2026-11-18T12:00', stores: 164, items: 97_262, promos: 5 };
  await writeMeta(db, meta);
  assert.deepEqual(replaced, [{ name: 'shoppingMeta', filter: { _id: 'ingest' }, doc: meta, upsert: true }]);
});
