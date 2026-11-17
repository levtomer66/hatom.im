#!/usr/bin/env node
// `npm run shopping:search-index` — create the Atlas Search index the
// /shopping product search uses, if it isn't there yet. Atlas only (Docker
// Mongo has no Atlas Search; the app falls back to its regex search there).
//
// MONGODB_URI comes from .env.shopping (gitignored), like the ingest.
// Pass --show to print what's on the cluster without creating anything.
import { MongoClient } from 'mongodb';
import { COLLECTIONS } from '../src/lib/shopping/collections.ts';
import { ITEMS_SEARCH_DEFINITION, ITEMS_SEARCH_INDEX } from '../src/lib/shopping/search-index.ts';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set (put it in .env.shopping)');
  process.exit(1);
}
const show = process.argv.includes('--show');
const client = new MongoClient(uri);
try {
  await client.connect();
  const items = client.db().collection(COLLECTIONS.items);
  const existing = await items.listSearchIndexes(ITEMS_SEARCH_INDEX).toArray();
  if (existing.length) {
    const ix = existing[0];
    console.log(`${ITEMS_SEARCH_INDEX}: ${ix.queryable ? 'ready' : 'not queryable yet'} (status ${ix.status ?? 'unknown'})`);
    if (show) console.log(JSON.stringify(ix.latestDefinition ?? ix, null, 2));
    if (JSON.stringify(ix.latestDefinition?.mappings) !== JSON.stringify(ITEMS_SEARCH_DEFINITION.mappings)) {
      console.log('Note: the cluster definition differs from search-index.ts; update it in Atlas or drop and re-run.');
    }
  } else if (show) {
    console.log(`${ITEMS_SEARCH_INDEX}: missing`);
  } else {
    await items.createSearchIndex({ name: ITEMS_SEARCH_INDEX, definition: ITEMS_SEARCH_DEFINITION });
    console.log(`${ITEMS_SEARCH_INDEX}: created; Atlas builds it in the background (a few minutes)`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
