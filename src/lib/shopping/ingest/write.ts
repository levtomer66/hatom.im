// What the price ingest does to Mongo. Imports the driver's types only, so
// this file loads under `node --test`; ingest/cli.ts hands it the live Db.

import { COLLECTIONS } from '../collections.ts';

/** The part of the driver's Db that ensureIndexes uses. */
export interface IndexDb {
  collection(name: string): {
    createIndex(spec: Record<string, 1>, options?: { sparse?: boolean }): Promise<unknown>;
    dropIndex(name: string): Promise<unknown>;
  };
}

/** Mongo's codes for "no such index" and "no such collection" (a new database). */
const NOTHING_TO_DROP = new Set([27, 26]);

/**
 * The indexes the app's queries need. The stores `{ city: 1 }` index is from
 * the city-based app: nothing queries stores by city now (the near set reads
 * every candidate store), so it is dropped where it still exists.
 */
export async function ensureIndexes(db: IndexDb): Promise<void> {
  // The basket query: every promo that lists one of the basket's items.
  await db.collection(COLLECTIONS.promos).createIndex({ items: 1 });
  // In-store "לא היה": alternatives in the same department (app's /api/shopping/alternatives).
  await db.collection(COLLECTIONS.items).createIndex({ d: 1 }, { sparse: true });
  try {
    await db.collection(COLLECTIONS.stores).dropIndex('city_1');
  } catch (e) {
    if (!NOTHING_TO_DROP.has((e as { code?: number }).code ?? -1)) throw e;
  }
}
