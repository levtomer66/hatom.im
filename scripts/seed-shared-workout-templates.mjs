#!/usr/bin/env node
// Seed Tomer's curated SHARED workout templates (the "Workouts by Tomer" tab).
// Idempotent: upserts by (userId, name) so re-running updates in place rather
// than duplicating. DRY-RUN by default — prints the plan; pass --apply to write.
//
// Fields match the WorkoutTemplate mongoose schema (collection: workouttemplates):
//   userId, name, exercises[{exerciseId,numSets,notes,supersetGroup}],
//   sharedByOwner, description, instagramUrl, createdAt, updatedAt.
// Exercises sharing a `supersetGroup` (1-based) render as a superset.
//
// Usage:
//   node scripts/seed-shared-workout-templates.mjs            # dry-run
//   node scripts/seed-shared-workout-templates.mjs --apply    # write

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

// Names are stored in English (canonical); the app shows a Hebrew title in
// Hebrew mode via TEMPLATE_NAME_TRANSLATIONS in src/lib/workout-i18n.ts.
const TEMPLATES = [
  {
    name: 'Quick Full Body',
    description:
      'Protocol: 2 sets per superset · 8–10 reps heavy · 1.5 min rest between sets · 2.5 min rest between exercises.',
    instagramUrl: 'https://www.instagram.com/p/DU8z7egCOPT/',
    exercises: [
      ex('incline-bench-press', 2, '8–10 · heavy', 1),
      ex('wide-grip-lat-pulldown', 2, '8–10 · heavy', 1),
      ex('pec-deck', 2, '8–10 · heavy', 2),
      ex('dumbbell-lateral-raise', 2, '8–10 · heavy', 2),
      ex('v-bar-pushdown', 2, '8–10 · heavy', 3),
      ex('barbell-curl', 2, '8–10 · heavy', 3),
      ex('leg-press', 2, '8–10 · heavy'),
    ],
  },
  {
    name: 'Shoulders & Arms Focus',
    description: 'Shoulders & arms focus · 6–8 reps (last sets up to 8–10).',
    instagramUrl: 'https://www.instagram.com/p/DTLQ1WeiLWp/',
    exercises: [
      ex('machine-shoulder-press', 2, '6–8'),
      ex('one-hand-cable-pushdown', 2, '6–8 · single-arm'),
      ex('dumbbell-lateral-raise', 3, '6-8, 6-8, 8-10'),
      ex('barbell-curl', 3, '6-8, 6-8, 8-10'),
      ex('overhead-rope-press', 3, '6-8, 6-8, 8-10'),
      ex('hammer-curl', 2, '6–8'),
    ],
  },
  {
    name: 'Short Upper Body',
    description: 'Short upper-body split · all machines · 6–8 reps.',
    instagramUrl: 'https://www.instagram.com/p/DLkMxTtIHUj/',
    exercises: [
      ex('chest-press-machine', 2, '6–8'),
      ex('wide-grip-lat-pulldown', 2, '6–8 · single-arm'),
      ex('pec-deck', 1, '6–8'),
      ex('wide-pull-belly', 1, '6–8 · wide row'),
      ex('cable-lateral-raise', 2, '6–8'),
      ex('biceps-preacher-curl', 2, '6–8 · preacher'),
      ex('one-hand-cable-pushdown', 2, '6–8'),
      ex('ab-cable-crunch', 2, '6–8'),
    ],
  },
  {
    name: 'Short Push',
    description: 'Short push session · 5–7 reps.',
    instagramUrl: '',
    exercises: [
      ex('incline-bench-press', 2, '5–7 · elbows 45°'),
      ex('chest-press-machine', 2, '5–7'),
      ex('machine-shoulder-press', 1, '5–7'),
      ex('pec-deck', 2, '5–7'),
      ex('cable-lateral-raise', 3, '5–7'),
      ex('v-bar-pushdown', 2, '5–7'),
      ex('parallels', 2, '5–7 · dips'),
    ],
  },
];

// The first seed run stored these under Hebrew names; delete those so the
// English-named upserts below don't leave Hebrew-named duplicates behind.
const LEGACY_HEBREW_NAMES = [
  'אימון גוף מלא מהיר',
  'אימון דגש כתפיים ידיים',
  'פלג גוף עליון מקוצר',
  'אימון פוש קצר',
];

const client = new MongoClient(MONGO);
const now = new Date();

try {
  await client.connect();
  const col = client.db().collection('workouttemplates');

  console.log(`\n=== MODE: ${APPLY ? 'APPLY (upsert)' : 'DRY-RUN (no writes)'} ===`);
  console.log(`owner: ${OWNER}\n`);

  // Migrate away the first run's Hebrew-named docs.
  const legacy = await col
    .find({ userId: OWNER, name: { $in: LEGACY_HEBREW_NAMES } })
    .project({ name: 1 })
    .toArray();
  if (legacy.length) {
    console.log(`DELETE ${legacy.length} legacy Hebrew-named doc(s): ${legacy.map((d) => d.name).join(', ')}`);
    if (APPLY) {
      const del = await col.deleteMany({ userId: OWNER, name: { $in: LEGACY_HEBREW_NAMES } });
      console.log(`  deleted: ${del.deletedCount}`);
    }
    console.log('');
  }

  for (const t of TEMPLATES) {
    const existing = await col.findOne({ userId: OWNER, name: t.name });
    const supersets = [...new Set(t.exercises.map((e) => e.supersetGroup).filter((g) => g))].length;
    console.log(
      `${existing ? 'UPDATE' : 'INSERT'}  "${t.name}"  ` +
        `(${t.exercises.length} exercises, ${supersets} superset group(s), ` +
        `${t.instagramUrl ? 'has link' : 'no link'})`,
    );
    for (const e of t.exercises) {
      console.log(`    - ${e.exerciseId}  ×${e.numSets}  ${e.supersetGroup ? `[SS ${e.supersetGroup}]` : ''}  ${e.notes}`);
    }

    if (APPLY) {
      await col.updateOne(
        { userId: OWNER, name: t.name },
        {
          $set: {
            exercises: t.exercises,
            sharedByOwner: true,
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
    const count = await col.countDocuments({ userId: OWNER, sharedByOwner: true });
    console.log(`\nDone. ${OWNER} now has ${count} shared template(s).`);
  }
} finally {
  await client.close();
}
