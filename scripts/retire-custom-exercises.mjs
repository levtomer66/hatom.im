#!/usr/bin/env node
// One-shot cleanup for retiring the custom-exercise feature.
//
// The code change (a) promoted the two REAL user-created customs into the
// code library and aliased their ids, and (b) removed the create UI + the
// GET/POST endpoint + every client fetch. After deploying that, the
// `customexercises` collection is orphaned (nothing reads it) and the two
// promoted exercises resolve from history via EXERCISE_ID_ALIASES:
//
//   custom-e609e9b2  "לחיצת חזה בכבל" (Tomer) -> cable-chest-press   [KEPT]
//   custom-b610b359  "Row"           (Tom)   -> seated-cable-row     [KEPT]
//
// The remaining three were test junk ("3"/"4", Tom) and are deleted along
// with the test workouts that reference them (per the migration decision):
//
//   custom-ad1ca649  "4"  (Tom)  -> 1 workout   [DELETE def + workout]
//   custom-789816a0  "3"  (Tom)  -> 2 workouts  [DELETE def + workouts]
//   custom-f9aa9b17  "4"  (Tom)  -> 0 workouts  [DELETE def]
//
// This script:
//   1. Deletes the workout docs that reference a JUNK id (Tom's test
//      workouts). The promoted-exercise workouts are KEPT.
//   2. Deletes ALL 5 customexercises docs (the 2 promoted ones are now
//      redundant — they live in the code library — and the 3 junk ones).
//
// Idempotent + safe to re-run. DRY-RUN by default — it prints exactly what
// it will delete (including each junk workout's full exercise list, so you
// can eyeball that none holds real data). Pass --apply to execute.
//
// Usage:
//   node scripts/retire-custom-exercises.mjs            # dry-run (default)
//   node scripts/retire-custom-exercises.mjs --apply    # delete for real

import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { MongoClient } from 'mongodb';

const APPLY = process.argv.includes('--apply');
const MONGO = process.env.MONGODB_URI;
if (!MONGO) {
  console.error('MONGODB_URI missing (populate .env.local via `vercel env pull`)');
  process.exit(1);
}

// Promoted into the code library + aliased — DEFINITIONS are redundant and
// get deleted, but their WORKOUTS are kept (they resolve via alias).
const PROMOTED_IDS = ['custom-e609e9b2', 'custom-b610b359'];
// Test junk — DEFINITIONS and the WORKOUTS referencing them get deleted.
const JUNK_IDS = ['custom-ad1ca649', 'custom-789816a0', 'custom-f9aa9b17'];
const ALL_CUSTOM_IDS = [...PROMOTED_IDS, ...JUNK_IDS];

const client = new MongoClient(MONGO);

function summarizeWorkout(w) {
  return {
    id: w._id.toString(),
    userId: w.userId,
    name: w.workoutName,
    date: w.date,
    isCompleted: !!w.isCompleted,
    exercises: (w.exercises || []).map((e) => {
      const logged = (e.sets || []).filter(
        (s) => (s.kg != null && s.reps != null) || (s.seconds != null && s.seconds > 0),
      ).length;
      return `${e.exerciseId} (${(e.sets || []).length} sets, ${logged} logged)`;
    }),
  };
}

try {
  await client.connect();
  const db = client.db();
  const customCol = db.collection('customexercises');
  const workoutCol = db.collection('workouts');

  console.log(`\n=== MODE: ${APPLY ? 'APPLY (will delete)' : 'DRY-RUN (no writes)'} ===\n`);

  // 1) Inventory the customexercises docs.
  const allCustoms = await customCol.find({}).toArray();
  console.log(`customexercises docs present: ${allCustoms.length}`);
  for (const c of allCustoms) {
    const bucket = JUNK_IDS.includes(c.exerciseId)
      ? 'JUNK (delete def)'
      : PROMOTED_IDS.includes(c.exerciseId)
        ? 'PROMOTED (delete redundant def; workouts kept via alias)'
        : 'UNKNOWN (left untouched)';
    console.log(`  - ${c.exerciseId}  "${c.name}"  owner=${c.userId}  -> ${bucket}`);
  }

  // 2) Workouts that reference a JUNK id — these get deleted entirely.
  const junkWorkouts = await workoutCol
    .find({ 'exercises.exerciseId': { $in: JUNK_IDS } })
    .toArray();
  console.log(`\nworkouts referencing JUNK ids (WILL DELETE): ${junkWorkouts.length}`);
  for (const w of junkWorkouts) console.log('  ' + JSON.stringify(summarizeWorkout(w)));

  // Workouts referencing PROMOTED ids — KEPT (just reported for confidence).
  const promotedWorkouts = await workoutCol
    .find({ 'exercises.exerciseId': { $in: PROMOTED_IDS } })
    .toArray();
  console.log(`\nworkouts referencing PROMOTED ids (KEPT — resolve via alias): ${promotedWorkouts.length}`);
  for (const w of promotedWorkouts) console.log('  ' + JSON.stringify(summarizeWorkout(w)));

  if (!APPLY) {
    console.log('\nDRY-RUN complete. Re-run with --apply to delete the above JUNK workouts + all 5 custom defs.');
    await client.close();
    process.exit(0);
  }

  // --- APPLY ---
  const delWorkouts = await workoutCol.deleteMany({ 'exercises.exerciseId': { $in: JUNK_IDS } });
  console.log(`\nDeleted junk workouts: ${delWorkouts.deletedCount}`);

  const delCustoms = await customCol.deleteMany({ exerciseId: { $in: ALL_CUSTOM_IDS } });
  console.log(`Deleted customexercises defs: ${delCustoms.deletedCount}`);

  // Sanity: any custom-* ids still left in workout history?
  const leftover = await workoutCol
    .aggregate([
      { $unwind: '$exercises' },
      { $match: { 'exercises.exerciseId': /^custom-/ } },
      { $group: { _id: '$exercises.exerciseId', n: { $sum: 1 } } },
    ])
    .toArray();
  console.log(`\nRemaining custom-* ids in workout history: ${leftover.length}`);
  for (const l of leftover) {
    const aliased = PROMOTED_IDS.includes(l._id) ? ' (aliased -> library, OK)' : ' (UNEXPECTED)';
    console.log(`  - ${l._id}: ${l.n}${aliased}`);
  }

  const remainingCustoms = await customCol.countDocuments({});
  console.log(`\ncustomexercises docs remaining: ${remainingCustoms} (expect 0)`);
  console.log('\nDone.');
} finally {
  await client.close();
}
