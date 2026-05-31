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
// Safe to re-run — both operations are idempotent. The index swap only
// drops the old index when it's actually the legacy sparse one; if the
// correct partial index is already present it's left untouched (no
// drop → no unprotected write window on re-runs).
//
// OPERATIONAL NOTE (Codex P0/P1): the FIRST swap necessarily drops the
// old unique index and recreates it, and MongoDB has no atomic
// "replace unique index" for the same key pattern. During that brief
// window writes aren't uniqueness-checked. This is a MANUAL one-shot —
// run it during low traffic. It is NOT on any request path: the
// Mongoose model declares the partial index and serverless cold starts
// reconcile it via createIndexes(), which never drops, so no request
// ever opens an unprotected window. After the swap, this script
// re-scans for duplicate (userId, clientRequestId) pairs and reports
// any that slipped in.
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

// Step 2 — ensure the (userId, clientRequestId) index is the unique
// PARTIAL variant. Only drop+recreate when the existing index is the
// legacy sparse one; if it's already partial we leave it alone so a
// re-run opens no unprotected write window (Codex P0).
console.log('Step 2 — index reconcile');
const indexes = await col.indexes();
const existing = indexes.find((ix) => ix.name === 'userId_1_clientRequestId_1');

const isAlreadyPartial =
  existing &&
  existing.unique === true &&
  existing.partialFilterExpression &&
  existing.partialFilterExpression.clientRequestId &&
  existing.partialFilterExpression.clientRequestId.$type === 'string';

if (isAlreadyPartial) {
  console.log('  index already the unique-partial variant — leaving untouched (no drop, no gap).');
} else {
  // Pre-flight: refuse to drop if duplicate real-UUID pairs already
  // exist, because the recreate would fail and leave us with NO index.
  const dupes = await col.aggregate([
    { $match: { clientRequestId: { $type: 'string' } } },
    { $group: { _id: { u: '$userId', c: '$clientRequestId' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]).toArray();
  if (dupes.length > 0) {
    console.error(`  ABORT: ${dupes.length} duplicate (userId, clientRequestId) pair(s) exist — resolve these before swapping or createIndex will fail and leave no index:`);
    for (const d of dupes) console.error('   ', d._id, '×', d.n);
    await client.close();
    process.exit(1);
  }
  if (existing) {
    console.log('  dropping legacy index:', JSON.stringify({ unique: existing.unique, sparse: existing.sparse, partial: !!existing.partialFilterExpression }));
    await col.dropIndex('userId_1_clientRequestId_1');
  }
  const name = await col.createIndex(
    { userId: 1, clientRequestId: 1 },
    {
      unique: true,
      partialFilterExpression: { clientRequestId: { $type: 'string' } },
      name: 'userId_1_clientRequestId_1',
    },
  );
  console.log('  created unique-partial index:', name);
}

const finalIndexes = await col.indexes();
const target = finalIndexes.find((ix) => ix.name === 'userId_1_clientRequestId_1');
console.log('userId_1_clientRequestId_1 index:', target ? '✓' : '✗', target?.partialFilterExpression ? '(partial)' : '');

await client.close();
