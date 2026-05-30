#!/usr/bin/env node
// One-shot migration to get the (userId, clientRequestId) idempotency
// index into a working state.
//
// Two pieces:
//
//   1. UNSET any explicit-null `clientRequestId` values. The Round-2
//      idempotency commit set the schema default to `null`, so any
//      workout touched while that code was live had the field written
//      as `null`. The Codex P0 fix stopped writing null going forward.
//      We sweep the legacy nulls so the index doesn't see them.
//
//   2. SWAP the index from sparse → partial. A sparse compound index
//      on (userId, clientRequestId) does NOT actually exclude docs
//      missing clientRequestId — sparse compound only requires AT
//      LEAST ONE indexed field to exist, and userId always does. So
//      every legacy doc gets indexed at (userId, null) and the
//      uniqueness constraint blows up on creation. A `partialFilter
//      Expression: { clientRequestId: { $type: 'string' } }` index
//      only includes docs that actually have a real UUID, which is
//      the behavior we want.
//
// Safe to re-run — both operations are idempotent.
//
// Usage:
//   node scripts/scrub-workout-client-request-id-nulls.mjs            # dry-run
//   node scripts/scrub-workout-client-request-id-nulls.mjs --apply    # do it

import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { MongoClient } from 'mongodb';

const APPLY = process.argv.includes('--apply');
const MONGO = process.env.MONGODB_URI;
if (!MONGO) {
  console.error('MONGODB_URI missing');
  process.exit(1);
}

console.log(APPLY ? '*** APPLYING CHANGES ***' : '(dry-run — pass --apply to write)');

const client = new MongoClient(MONGO);
await client.connect();
const col = client.db().collection('workouts');

const before = {
  total: await col.countDocuments({}),
  withNull: await col.countDocuments({ clientRequestId: null }),
  withRealUuid: await col.countDocuments({ clientRequestId: { $exists: true, $ne: null } }),
  fieldMissing: await col.countDocuments({ clientRequestId: { $exists: false } }),
};
console.log('before:', before);

if (before.withNull === 0) {
  console.log('Nothing to scrub.');
  await client.close();
  process.exit(0);
}

if (!APPLY) {
  console.log(`Would unset clientRequestId on ${before.withNull} document(s).`);
  await client.close();
  process.exit(0);
}

// Step 1 — unset explicit-null values. Skips docs that are simply
// missing the field (sparse OK on those, partial filter ignores).
const res = await col.updateMany(
  { $and: [{ clientRequestId: { $exists: true } }, { clientRequestId: null }] },
  { $unset: { clientRequestId: '' } },
);
console.log(`Step 1 — unset null: matched ${res.matchedCount}, modified ${res.modifiedCount}.`);

const after = {
  total: await col.countDocuments({}),
  withNull: await col.countDocuments({ clientRequestId: null }),
  withRealUuid: await col.countDocuments({ clientRequestId: { $exists: true, $ne: null } }),
  fieldMissing: await col.countDocuments({ clientRequestId: { $exists: false } }),
};
console.log('after step 1:', after);

// Step 2 — swap any pre-existing sparse index for the partial-filter
// variant. Drop-by-name is no-op if the index doesn't exist; then
// recreate with partialFilterExpression. Idempotent across repeat runs.
console.log('Step 2 — index swap');
const indexes = await col.indexes();
const existing = indexes.find((ix) => ix.name === 'userId_1_clientRequestId_1');
if (existing) {
  console.log('  dropping existing index:', existing);
  await col.dropIndex('userId_1_clientRequestId_1');
}
try {
  const name = await col.createIndex(
    { userId: 1, clientRequestId: 1 },
    {
      unique: true,
      partialFilterExpression: { clientRequestId: { $type: 'string' } },
      name: 'userId_1_clientRequestId_1',
    },
  );
  console.log('  created index:', name);
} catch (err) {
  console.error('  index creation failed:', err.message);
  console.error('  → there may still be duplicate clientRequestId values among real-UUID rows.');
}

const finalIndexes = await col.indexes();
const target = finalIndexes.find((ix) => ix.name === 'userId_1_clientRequestId_1');
console.log('userId_1_clientRequestId_1 index:', target ? '✓' : '✗', target?.partialFilterExpression ? '(partial)' : '');

await client.close();
