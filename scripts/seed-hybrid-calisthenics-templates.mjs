#!/usr/bin/env node
// Seed Tomer's "Hybrid Calisthenics + Hypertrophy" 3-day split (Push/Pull/Upper).
// Idempotent: upserts by (userId, name) so re-running updates in place rather
// than duplicating. DRY-RUN by default — prints the plan; pass --apply to write.
//
// Fields match the WorkoutTemplate mongoose schema (collection: workouttemplates):
//   userId, name, exercises[{exerciseId,numSets,notes,supersetGroup}],
//   sharedByOwner, description, instagramUrl, createdAt, updatedAt.
// Personal (non-shared) templates — sharedByOwner is left false.
//
// Usage:
//   node scripts/seed-hybrid-calisthenics-templates.mjs            # dry-run
//   node scripts/seed-hybrid-calisthenics-templates.mjs --apply    # write

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

const OWNER = 'levtomer66@gmail.com';

// numSets, notes (rep scheme), and supersetGroup per exercise.
const ex = (exerciseId, numSets, notes, supersetGroup = null) => ({
  exerciseId,
  numSets,
  notes,
  supersetGroup,
});

// Names are stored in English (canonical); Hebrew display names are added to
// TEMPLATE_NAME_TRANSLATIONS in src/lib/workout-i18n.ts.
const TEMPLATES = [
  {
    name: 'Push — Planche & Pressing',
    description:
      'Skill first while fresh, then calisthenics strength, then machine/cable hypertrophy. No failure on skill work.',
    instagramUrl: '',
    exercises: [
      ex('handstand-hspu-progression', 4, '3–5 sets · Wall Handstand → Freestanding → Pike HSPU → Wall HSPU · no failure'),
      ex('weighted-parallels', 2, '5–8 reps · hit 8,8 then add weight'),
      ex('planche-progression', 2, '8–15s hold · Tuck → Advanced Tuck → Straddle → Full'),
      ex('push-up-progression', 2, '8–15 reps'),
      ex('incline-chest-machine', 2, '8–12 reps'),
      ex('cable-lateral-raise', 2, '12–20 reps'),
      ex('overhead-rope-press', 2, '10–15 reps'),
      ex('tricep-pushdown', 2, '12–15 reps'),
    ],
  },
  {
    name: 'Pull — Front Lever',
    description:
      'Skill first while fresh, then calisthenics strength, then machine/cable hypertrophy. No failure on skill work.',
    instagramUrl: '',
    exercises: [
      ex('front-lever-progression', 4, '3–5 sets · 8–15s hold · no failure'),
      ex('weighted-pull-up', 2, '5–8 reps'),
      ex('explosive-pullup-progression', 3, '3–5 reps · speed + technique, no failure'),
      ex('front-lever-row', 2, '5–10 reps'),
      ex('front-lever-pulldown', 2, '10–15 reps · builds front lever + lats'),
      ex('face-pull', 2, '15–20 reps'),
      ex('seated-dumbbell-curl', 2, '10–15 reps · incline seated curl'),
      ex('brachialis-rope-curl', 2, '10–15 reps'),
    ],
  },
  {
    name: 'Upper — Skills & Strength',
    description:
      'Combines skill work with calisthenics + machine strength/hypertrophy. No failure on skill work.',
    instagramUrl: '',
    exercises: [
      ex('handstand-progression', 3, 'no failure'),
      ex('muscle-up-progression', 4, '3–5 sets · False Grip Pull-ups / Transition Drills / Explosive Pull-ups · no failure'),
      ex('front-lever-progression', 3, 'no failure'),
      ex('weighted-parallels', 3, '6–10 reps · absorbs the volume of the removed Ring Dips/Archer Pull-ups'),
      ex('weighted-pull-up', 2, '6–10 reps'),
      ex('wide-grip-lat-pulldown', 1, '10–15 reps · right after Weighted Pull-ups'),
      ex('pec-deck', 2, '12–15 reps'),
      ex('bayesian-curl', 2, '10–15 reps · single-arm'),
      ex('v-bar-pushdown', 2, '12–15 reps'),
    ],
  },
];

const client = new MongoClient(MONGO);
const now = new Date();

try {
  await client.connect();
  const col = client.db().collection('workouttemplates');

  console.log(`\n=== MODE: ${APPLY ? 'APPLY (upsert)' : 'DRY-RUN (no writes)'} ===`);
  console.log(`owner: ${OWNER}\n`);

  for (const t of TEMPLATES) {
    const existing = await col.findOne({ userId: OWNER, name: t.name });
    console.log(
      `${existing ? 'UPDATE' : 'INSERT'}  "${t.name}"  (${t.exercises.length} exercises)`,
    );
    for (const e of t.exercises) {
      console.log(`    - ${e.exerciseId}  ×${e.numSets}  ${e.notes}`);
    }

    if (APPLY) {
      await col.updateOne(
        { userId: OWNER, name: t.name },
        {
          $set: {
            exercises: t.exercises,
            sharedByOwner: false,
            description: t.description,
            instagramUrl: t.instagramUrl,
            updatedAt: now,
          },
          $setOnInsert: { userId: OWNER, name: t.name, createdAt: now },
        },
        { upsert: true },
      );
    }
  }

  if (!APPLY) {
    console.log('\nDRY-RUN complete. Re-run with --apply to upsert these into workouttemplates.');
  } else {
    const count = await col.countDocuments({ userId: OWNER, name: { $in: TEMPLATES.map((t) => t.name) } });
    console.log(`\nDone. ${count}/${TEMPLATES.length} templates present for ${OWNER}.`);
  }
} finally {
  await client.close();
}
