import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureIndexes, type IndexDb } from '../shopping/ingest/write.ts';

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
