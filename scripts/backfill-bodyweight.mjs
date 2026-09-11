/**
 * One-off backfill: apply bodyweight to a single user's historical workouts
 * and their shared feed posts, so past calisthenics volume reflects bodyweight.
 *
 * Scope: ONE user (default levtomer66@gmail.com — the only calisthenics user).
 * The app itself is forward-only (it never backfills); this script is the
 * deliberate exception the design called for.
 *
 * What it does (only for workouts that contain a bodyweight exercise):
 *   1. Stamps each bodyweight exercise's `load = { mode:'bodyweight', factor }`
 *      and sets `workout.bodyweightKg = <BW>` on the workout doc, so the app's
 *      computeWorkoutStats recomputes volume everywhere (history, re-share).
 *   2. Recomputes the frozen `stats.totalVolumeKg` on the matching feed posts.
 *
 * The volume math here is a faithful copy of src/lib/workout-load.ts +
 * workout-stats.ts (bodyweight + standard modes only — per-side/dumbbell gear
 * is per-user and not part of this backfill).
 *
 * Usage:
 *   BW_KG=78 node scripts/backfill-bodyweight.mjs           # DRY RUN (no writes)
 *   BW_KG=78 APPLY=1 node scripts/backfill-bodyweight.mjs   # apply
 *   BW_KG=78 USER_EMAIL=other@x.com node ...                # override user
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Which env file to read MONGODB_URI from. Default .env.local; override with
// ENV_FILE=.env.production.local (e.g. after `vercel env pull`). An inline
// MONGODB_URI in the shell also wins (dotenv never overrides an existing var).
dotenv.config({ path: process.env.ENV_FILE || '.env.local' });

const USER = process.env.USER_EMAIL || 'levtomer66@gmail.com';
const BW = Number(process.env.BW_KG);
const APPLY = process.env.APPLY === '1';

if (!process.env.MONGODB_URI) {
  console.error('Error: MONGODB_URI is not set (populate .env.local).');
  process.exit(1);
}
if (!Number.isFinite(BW) || BW <= 0 || BW > 500) {
  console.error('Error: set a valid bodyweight, e.g. BW_KG=78');
  process.exit(1);
}

// Copied verbatim from src/data/exercise-library.ts BODYWEIGHT_FACTORS.
const BODYWEIGHT_FACTORS = {
  'pull-up': 1, 'chin-up': 1, 'muscle-up': 1, 'muscle-up-progression': 1,
  'explosive-pullup-progression': 1, 'weighted-pull-up': 1, 'negative-pull-up': 1,
  'parallels': 1, 'weighted-parallels': 1, 'negative-dip': 1, 'dip': 0.5,
  'push-up': 0.65, 'push-up-progression': 0.65, 'elevated-push-up': 0.5,
  'handstand-hspu-progression': 0.7,
  'inverted-row': 0.6, 'wide-row-rear-delt': 0.6, 'front-lever-row': 0.6,
  'pistol-squat': 0.85, 'elevated-pistol-squat': 0.85, 'deep-squat-bw': 0.6,
  'split-squat-bw': 0.7, 'step-up': 0.7, 'single-leg-rdl': 0.85, 'nordic-curl': 0.9,
  'hanging-leg-raise': 0.5, 'hanging-knee-raise-v3': 0.5,
};
// Copied verbatim from EXERCISE_ID_ALIASES (only ids that could appear in old data).
const ALIASES = {
  'lat-pulldown': 'wide-grip-lat-pulldown',
  'hip-flexors': 'adductors',
  'custom-e609e9b2': 'cable-chest-press',
  'custom-b610b359': 'seated-cable-row',
};
const resolveId = (id) => ALIASES[id] ?? id;
const isTimeSet = (s) => s.seconds != null;

// Mirror of effectiveSetKg (bodyweight + standard modes only).
function effectiveSetKg(kg, load, bodyweightKg) {
  const entered = kg ?? 0;
  if (load?.mode === 'bodyweight') return (bodyweightKg ?? 0) * (load.factor ?? 1) + entered;
  return entered;
}
// Mirror of computeWorkoutStats().totalVolumeKg.
function volumeOf(workout) {
  let vol = 0;
  for (const ex of workout.exercises ?? []) {
    for (const s of ex.sets ?? []) {
      if (!isTimeSet(s) && s.reps != null && s.reps > 0) {
        vol += effectiveSetKg(s.kg, ex.load, workout.bodyweightKg) * s.reps;
      }
    }
  }
  return vol;
}
const r = (n) => Math.round(n).toLocaleString();

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db();
    const workouts = db.collection('workouts');
    const feed = db.collection('workoutFeedPosts');
    const customs = db.collection('customexercises');

    // Merge any of this user's custom bodyweight exercises into the factor map.
    const factors = { ...BODYWEIGHT_FACTORS };
    for (const c of await customs.find({ userId: USER, loadMode: 'bodyweight' }).toArray()) {
      factors[c.exerciseId] = typeof c.bodyweightFactor === 'number' ? c.bodyweightFactor : 1;
    }

    console.log(`\n=== Backfill bodyweight — ${APPLY ? 'APPLY' : 'DRY RUN'} ===`);
    console.log(`User: ${USER}   Bodyweight: ${BW} kg\n`);

    // --- Workouts ---
    const wkList = await workouts.find({ userId: USER }).toArray();
    const volById = new Map();
    let bwWorkouts = 0;
    let wkWritten = 0;

    console.log(`Workouts scanned: ${wkList.length}`);
    for (const w of wkList) {
      const oldVol = volumeOf({ ...w, bodyweightKg: null }); // pre-backfill (standard)
      let hasBw = false;
      for (const ex of w.exercises ?? []) {
        const f = factors[resolveId(ex.exerciseId)];
        if (f != null) {
          ex.load = { mode: 'bodyweight', factor: f, entry: null, barWeightKg: null };
          hasBw = true;
        }
      }
      w.bodyweightKg = hasBw ? BW : (w.bodyweightKg ?? null);
      const newVol = volumeOf(w);
      volById.set(w._id.toString(), newVol);

      if (hasBw) {
        bwWorkouts++;
        console.log(
          `  • ${w.date}  ${w.workoutName}  vol ${r(oldVol)} → ${r(newVol)} kg`,
        );
        if (APPLY) {
          await workouts.updateOne(
            { _id: w._id },
            { $set: { bodyweightKg: BW, exercises: w.exercises } },
          );
          wkWritten++;
        }
      }
    }
    console.log(`\nWorkouts with bodyweight exercises: ${bwWorkouts}${APPLY ? ` (written: ${wkWritten})` : ''}`);

    // --- Feed posts ---
    const posts = await feed.find({ userId: USER }).toArray();
    let feedChanged = 0;
    let feedSkipped = 0;
    console.log(`\nFeed posts scanned: ${posts.length}`);
    for (const p of posts) {
      const newVol = volById.get(p.workoutId);
      if (newVol == null) {
        feedSkipped++;
        console.log(`  • (skip) post ${p._id} — underlying workout not found`);
        continue;
      }
      const oldVol = p.stats?.totalVolumeKg ?? 0;
      if (Math.round(oldVol) === Math.round(newVol)) continue; // unchanged
      feedChanged++;
      console.log(`  • ${p.workoutDate} ${p.workoutName}  feed vol ${r(oldVol)} → ${r(newVol)} kg`);
      if (APPLY) {
        await feed.updateOne({ _id: p._id }, { $set: { 'stats.totalVolumeKg': newVol } });
      }
    }
    console.log(`\nFeed posts to update: ${feedChanged}${feedSkipped ? ` (skipped ${feedSkipped})` : ''}`);
    console.log(`\n${APPLY ? '✅ Applied.' : 'ℹ️  Dry run only — re-run with APPLY=1 to write.'}\n`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
