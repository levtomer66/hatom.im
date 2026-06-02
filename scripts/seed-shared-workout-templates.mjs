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

const TEMPLATES = [
  {
    name: 'אימון גוף מלא מהיר',
    description:
      'פרוטוקול: 2 סטים מכל סופר־סט · 8–10 חזרות במשקל כבד · 1.5 דק׳ מנוחה בין סטים · 2.5 דק׳ מנוחה בין תרגילים.',
    instagramUrl: 'https://www.instagram.com/p/DU8z7egCOPT/',
    exercises: [
      ex('incline-bench-press', 2, '8–10 · כבד', 1),
      ex('wide-grip-lat-pulldown', 2, '8–10 · כבד', 1),
      ex('pec-deck', 2, '8–10 · כבד', 2),
      ex('dumbbell-lateral-raise', 2, '8–10 · כבד', 2),
      ex('v-bar-pushdown', 2, '8–10 · כבד', 3),
      ex('barbell-curl', 2, '8–10 · כבד', 3),
      ex('leg-press', 2, '8–10 · כבד'),
    ],
  },
  {
    name: 'אימון דגש כתפיים ידיים',
    description: 'דגש כתפיים וידיים · 6–8 חזרות (סטים אחרונים עד 8–10).',
    instagramUrl: 'https://www.instagram.com/p/DTLQ1WeiLWp/',
    exercises: [
      ex('machine-shoulder-press', 2, '6–8'),
      ex('one-hand-cable-pushdown', 2, '6–8 · יד אחורית, יד-יד'),
      ex('dumbbell-lateral-raise', 3, '6-8, 6-8, 8-10'),
      ex('barbell-curl', 3, '6-8, 6-8, 8-10'),
      ex('overhead-rope-press', 3, '6-8, 6-8, 8-10'),
      ex('hammer-curl', 2, '6–8'),
    ],
  },
  {
    name: 'פלג גוף עליון מקוצר',
    description: 'פלג גוף עליון מקוצר · הכל במכונות · 6–8 חזרות.',
    instagramUrl: 'https://www.instagram.com/p/DLkMxTtIHUj/',
    exercises: [
      ex('chest-press-machine', 2, '6–8'),
      ex('wide-grip-lat-pulldown', 2, '6–8 · יד-יד'),
      ex('pec-deck', 1, '6–8'),
      ex('wide-pull-belly', 1, '6–8 · חתירה רחבה'),
      ex('cable-lateral-raise', 2, '6–8 · במכונה'),
      ex('biceps-preacher-curl', 2, '6–8 · כיסא כומר'),
      ex('one-hand-cable-pushdown', 2, '6–8 · יד אחורית, יד-יד'),
      ex('ab-cable-crunch', 2, '6–8 · כפיפת בטן'),
    ],
  },
  {
    name: 'אימון פוש קצר',
    description: 'אימון פוש קצר · 5–7 חזרות.',
    instagramUrl: '',
    exercises: [
      ex('incline-bench-press', 2, '5–7 · מרפקים 45°'),
      ex('chest-press-machine', 2, '5–7'),
      ex('machine-shoulder-press', 1, '5–7'),
      ex('pec-deck', 2, '5–7'),
      ex('cable-lateral-raise', 3, '5–7'),
      ex('v-bar-pushdown', 2, '5–7 · יד אחורית'),
      ex('parallels', 2, '5–7 · מקבילים במכונה'),
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
