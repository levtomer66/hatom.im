// One-off, fill-empty-only enrichment for the /mekafkefim coffeeReviews.
//
// Usage (load the Mongo URI first — .env.workout holds MONGODB_URI):
//   export MONGODB_URI="$(grep '^MONGODB_URI=' .env.workout | sed -E 's/^MONGODB_URI=//; s/^"//; s/"$//')"
//   node scripts/enrich-coffee-reviews.mjs --list
//   node scripts/enrich-coffee-reviews.mjs --apply scripts/coffee-enrichment.json
//
// SAFETY: --apply only writes an enrichable field when it is currently EMPTY on
// the doc. It never touches ratings, notes, triedItems, tags, disabledCategories,
// or any non-empty field. It validates each value and skips anything malformed.
// Re-running is safe (idempotent). Reads the URI from process.env.MONGODB_URI.

import { readFileSync } from 'node:fs';
import { MongoClient, ObjectId } from 'mongodb';

const ENRICH = ['photoUrl', 'mapsUrl', 'instagramUrl', 'lat', 'lng', 'area', 'openingHours'];
const STRING_FIELDS = new Set(['photoUrl', 'mapsUrl', 'instagramUrl']);
const NUMBER_FIELDS = new Set(['lat', 'lng']);

// Kept in sync with COFFEE_AREAS in src/types/coffee.ts (that file is import-free
// TS and can't be required from a .mjs; this is a one-off script).
const COFFEE_AREAS = new Set([
  'פלורנטין', 'נווה צדק', 'לב העיר/מרכז', 'הצפון הישן', 'הצפון החדש',
  'כרם התימנים', 'רוטשילד', 'שפירא', 'באזל', 'יפו', 'אחר',
]);

const HHMM = /^\d{2}:\d{2}$/;

function isEmpty(v) {
  return v === undefined || v === null || v === '';
}

function validOpeningHours(v) {
  if (!Array.isArray(v) || v.length !== 7) return false;
  return v.every((e) => {
    if (e === null) return true;
    if (typeof e !== 'object') return false;
    const { open, close } = e;
    return typeof open === 'string' && typeof close === 'string'
      && HHMM.test(open) && HHMM.test(close) && close > open;
  });
}

// Returns a sanitized value for a field, or undefined if it's invalid (skip it).
function sanitize(field, value) {
  if (isEmpty(value)) return undefined;
  if (STRING_FIELDS.has(field)) {
    return typeof value === 'string' && value.startsWith('http') ? value : undefined;
  }
  if (NUMBER_FIELDS.has(field)) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }
  if (field === 'area') return COFFEE_AREAS.has(value) ? value : undefined;
  if (field === 'openingHours') return validOpeningHours(value) ? value : undefined;
  return undefined;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('ERROR: MONGODB_URI is not set'); process.exit(1); }

  const mode = process.argv[2];
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db().collection('coffeeReviews');

  try {
    if (mode === '--list') {
      const docs = await col.find({}, {
        projection: Object.fromEntries([['placeName', 1], ...ENRICH.map((f) => [f, 1])]),
      }).toArray();
      for (const d of docs) {
        const missing = ENRICH.filter((f) => isEmpty(d[f]));
        console.log(`${d._id}  ${d.placeName}  missing: ${missing.join(', ') || '(none)'}`);
      }
      console.log(`\n${docs.length} places.`);
      return;
    }

    if (mode === '--apply') {
      const path = process.argv[3];
      if (!path) { console.error('ERROR: --apply needs a JSON file path'); process.exit(1); }
      const entries = JSON.parse(readFileSync(path, 'utf8'));
      let wrote = 0, skipped = 0;
      for (const entry of entries) {
        if (!entry?._id) { console.log('skip: entry with no _id'); continue; }
        const doc = await col.findOne({ _id: new ObjectId(entry._id) });
        if (!doc) { console.log(`skip: ${entry._id} not found`); continue; }
        const $set = {};
        const applied = [];
        for (const field of ENRICH) {
          if (!(field in entry)) continue;          // nothing researched for this field
          if (!isEmpty(doc[field])) continue;        // FILL-EMPTY-ONLY: never overwrite
          const clean = sanitize(field, entry[field]);
          if (clean === undefined) { console.log(`  ! ${entry.placeName}: invalid ${field}, skipped`); continue; }
          $set[field] = clean;
          applied.push(field);
        }
        if (Object.keys($set).length === 0) { skipped++; continue; }
        $set.updatedAt = new Date().toISOString();
        await col.updateOne({ _id: doc._id }, { $set });
        wrote++;
        console.log(`  ✓ ${doc.placeName}: set ${applied.join(', ')}`);
      }
      console.log(`\nDone. ${wrote} docs updated, ${skipped} unchanged.`);
      return;
    }

    console.error('Usage: --list | --apply <json>');
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
