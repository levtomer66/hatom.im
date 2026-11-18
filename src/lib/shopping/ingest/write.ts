// What the price ingest does to Mongo: indexes, the diff against
// state/written.json, throttled bulk writes, the meta doc. It imports the
// driver's types only, so this file loads under `node --test`; ingest/cli.ts
// hands it the live Db.
//
// Atlas M0 budget (512 MB incl. indexes, ~100 ops/s): only docs whose content
// hash changed are written, in batches with a pause between them.

import { COLLECTIONS, SNAPSHOT_COLLECTIONS } from '../collections.ts';
import { diffDocs, type Diff } from '../snapshot.ts';
import { sleep } from './cache.ts';

export const WRITE_BATCH = 500;
export const WRITE_PAUSE_MS = 1000; // Atlas M0: ~100 ops/s; it queues rather than fails, but be polite.

export type StringIdDoc = Record<string, unknown> & { _id: string };

export type WriteOp =
  | { replaceOne: { filter: { _id: string }; replacement: StringIdDoc; upsert: true } }
  | { deleteOne: { filter: { _id: string } } };

/** The part of the driver's Db the ingest uses (a test passes a stand-in). */
export interface IngestDb {
  collection(name: string): {
    createIndex(spec: Record<string, 1>, options?: { sparse?: boolean }): Promise<unknown>;
    dropIndex(name: string): Promise<unknown>;
    find(filter: Record<string, never>, options: { projection: Record<string, 1> }): { toArray(): Promise<Record<string, unknown>[]> };
    bulkWrite(ops: WriteOp[], options: { ordered: boolean }): Promise<unknown>;
    replaceOne(filter: { _id: string }, doc: Record<string, unknown>, options: { upsert: boolean }): Promise<unknown>;
  };
}
/** The part ensureIndexes uses. */
export type IndexDb = { collection(name: string): Pick<ReturnType<IngestDb['collection']>, 'createIndex' | 'dropIndex'> };

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

/** The short store keys Mongo holds — the authority over keys.json — or null when it has no stores yet. */
export async function mongoStoreKeys(db: Pick<IngestDb, 'collection'>): Promise<Record<string, number> | null> {
  const docs = await db.collection(COLLECTIONS.stores).find({}, { projection: { k: 1 } }).toArray();
  return docs.length ? Object.fromEntries(docs.map((d) => [String(d._id), d.k as number])) : null;
}

/** store collection → { doc id → content hash } of what Mongo holds (state/written.json). */
export type Written = Record<string, Record<string, string>>;

/**
 * --full: forget the hashes and take the ids from Mongo, so every doc is
 * rewritten and every doc Mongo holds that the run no longer builds is deleted.
 */
export async function forgetWritten(db: Pick<IngestDb, 'collection'>, written: Written): Promise<void> {
  for (const name of SNAPSHOT_COLLECTIONS) {
    const docs = await db.collection(name).find({}, { projection: { _id: 1 } }).toArray();
    written[name] = Object.fromEntries(docs.map((d) => [String(d._id), '']));
  }
}

export interface SnapshotDocs {
  chains: Map<string, { _id: string }>;
  stores: Map<string, { _id: string }>;
  items: Map<string, { _id: string }>;
  promos: Map<string, { _id: string }>;
}

/** What to write per collection, in the order it is written: chains, stores, items, promos. */
export function planWrites(docs: SnapshotDocs, written: Written): [name: string, diff: Diff<{ _id: string }>][] {
  return [
    [COLLECTIONS.chains, diffDocs(docs.chains, written[COLLECTIONS.chains] ?? {})],
    [COLLECTIONS.stores, diffDocs(docs.stores, written[COLLECTIONS.stores] ?? {})],
    [COLLECTIONS.items, diffDocs(docs.items, written[COLLECTIONS.items] ?? {})],
    [COLLECTIONS.promos, diffDocs(docs.promos, written[COLLECTIONS.promos] ?? {})],
  ];
}

/** Upserts and deletes in batches of WRITE_BATCH, pausing between batches. */
export async function writeCollection(
  db: Pick<IngestDb, 'collection'>,
  name: string,
  upserts: { _id: string }[],
  deletes: string[],
  log: (msg: string) => void,
  pause: (ms: number) => Promise<void> = sleep,
): Promise<void> {
  const col = db.collection(name);
  const ops: WriteOp[] = [
    ...upserts.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d as StringIdDoc, upsert: true as const } })),
    ...deletes.map((id) => ({ deleteOne: { filter: { _id: id } } })),
  ];
  for (let i = 0; i < ops.length; i += WRITE_BATCH) {
    await col.bulkWrite(ops.slice(i, i + WRITE_BATCH), { ordered: false });
    if (i + WRITE_BATCH < ops.length) await pause(WRITE_PAUSE_MS);
  }
  log(`  ${name}: ${upserts.length} upserted, ${deletes.length} deleted`);
}

/** The one meta doc, overwritten every run: when the ingest ran and how much it holds. */
export async function writeMeta(db: Pick<IngestDb, 'collection'>, meta: { at: Date; nowLocal: string; stores: number; items: number; promos: number }): Promise<void> {
  await db.collection(COLLECTIONS.meta).replaceOne({ _id: 'ingest' }, meta, { upsert: true });
}
