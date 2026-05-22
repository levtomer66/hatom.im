// One-time migration: convert the legacy short workout user ids
// ('tom', 'tomer', 'amit') to the corresponding Gmail addresses, so the
// workout module can key off the Auth.js session email after PR 4 lands.
//
// Run with:
//   node --env-file=.env.local scripts/migrate-workout-userids-to-emails.mjs
//
// Idempotent — re-running after a successful migration finds zero rows
// to update and exits cleanly. Backs out cleanly on connection errors.

import { MongoClient } from 'mongodb';

const MAP = Object.freeze({
  tom:   'tomzari347@gmail.com',
  tomer: 'levtomer66@gmail.com',
  amit:  'amitz2002@gmail.com',
});

const COLLECTIONS = ['workouts', 'workouttemplates', 'customexercises'];

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI missing (run with `node --env-file=.env.local ...`).');
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);

try {
  await client.connect();
  const db = client.db();

  // Sanity probe — list which collections actually exist, to catch typos.
  const present = (await db.listCollections().toArray()).map((c) => c.name);
  for (const name of COLLECTIONS) {
    if (!present.includes(name)) {
      console.warn(`  [skip] collection \`${name}\` does not exist`);
    }
  }

  const summary = { total: { matched: 0, modified: 0 } };

  for (const name of COLLECTIONS) {
    if (!present.includes(name)) continue;
    const col = db.collection(name);

    const before = {};
    for (const short of Object.keys(MAP)) {
      before[short] = await col.countDocuments({ userId: short });
    }

    console.log(`\n== ${name} ==`);
    console.log('  before:', before);

    summary[name] = { matched: 0, modified: 0 };
    for (const [short, email] of Object.entries(MAP)) {
      const res = await col.updateMany(
        { userId: short },
        { $set: { userId: email } }
      );
      summary[name].matched  += res.matchedCount;
      summary[name].modified += res.modifiedCount;
      summary.total.matched  += res.matchedCount;
      summary.total.modified += res.modifiedCount;
    }

    const remaining = {};
    for (const short of Object.keys(MAP)) {
      remaining[short] = await col.countDocuments({ userId: short });
    }
    console.log('  after :', remaining);

    if (Object.values(remaining).some((n) => n > 0)) {
      throw new Error(`Migration left rows behind in ${name}: ${JSON.stringify(remaining)}`);
    }
  }

  console.log('\n=== summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nMigration complete.');
} catch (err) {
  console.error('\nMigration failed:', err);
  process.exitCode = 1;
} finally {
  await client.close();
}
