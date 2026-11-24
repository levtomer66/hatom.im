import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { MAX_OPEN, STALE_MS, type ImportRequest } from '@/lib/recipes/imports';

// Import requests (spec § Import agent): one doc per request in `recipeImports`.
// People create and dismiss their own; the import agent (owner callers, through
// MCP) claims, completes or fails them.

type ImportDocument = Omit<ImportRequest, 'id'> & { _id: ObjectId };

let indexed = false;
async function col() {
  const c = (await clientPromise).db().collection<ImportDocument>('recipeImports');
  if (!indexed) {
    await Promise.all([c.createIndex({ requester: 1, at: -1 }), c.createIndex({ status: 1, at: 1 })]);
    indexed = true;
  }
  return c;
}

const oid = (id: string) => (/^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null);
const view = ({ _id, ...d }: ImportDocument): ImportRequest => ({ ...d, id: _id.toHexString() });
const OPEN = { $in: ['queued', 'working'] as ImportRequest['status'][] };

/** null when the person already has MAX_OPEN open requests. */
export async function createImport(requester: string, req: { url: string | null; text: string; note: string }): Promise<ImportRequest | null> {
  const c = await col();
  if ((await c.countDocuments({ requester, status: OPEN })) >= MAX_OPEN) return null;
  const doc: ImportDocument = {
    _id: new ObjectId(), requester, ...req, status: 'queued', recipeId: null, error: null,
    at: new Date().toISOString(), claimedAt: null, doneAt: null,
  };
  await c.insertOne(doc);
  return view(doc);
}

/** The person's open requests and those finished in the last day. */
export async function listMyImports(requester: string): Promise<ImportRequest[]> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const docs = await (await col()).find({ requester, $or: [{ status: OPEN }, { doneAt: { $gte: since } }] }).sort({ at: -1 }).limit(20).toArray();
  return docs.map(view);
}

/** The requester dismisses a finished one or cancels a queued one. */
export async function dismissImport(requester: string, id: string): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  const r = await (await col()).deleteOne({ _id, requester, status: { $in: ['queued', 'done', 'failed'] } });
  return r.deletedCount === 1;
}

/** Ids the agent should take now: queued, or working with a stale claim. */
export async function importQueue(): Promise<ImportRequest[]> {
  const stale = new Date(Date.now() - STALE_MS).toISOString();
  const docs = await (await col())
    .find({ $or: [{ status: 'queued' }, { status: 'working', claimedAt: { $lt: stale } }] }).sort({ at: 1 }).limit(20).toArray();
  return docs.map(view);
}

/** Atomic: only one agent run gets a request. */
export async function claimImport(id: string): Promise<ImportRequest | null> {
  const _id = oid(id);
  if (!_id) return null;
  const now = new Date();
  const stale = new Date(now.getTime() - STALE_MS).toISOString();
  const d = await (await col()).findOneAndUpdate(
    { _id, $or: [{ status: 'queued' }, { status: 'working', claimedAt: { $lt: stale } }] },
    { $set: { status: 'working', claimedAt: now.toISOString() } },
    { returnDocument: 'after' },
  );
  return d ? view(d) : null;
}

export async function getImport(id: string): Promise<ImportRequest | null> {
  const _id = oid(id);
  const d = _id ? await (await col()).findOne({ _id }) : null;
  return d ? view(d) : null;
}

/** Ends a working request (done with its recipe, or failed with a reason). */
export async function finishImport(id: string, end: { recipeId: string } | { error: string }): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  const set = 'recipeId' in end
    ? { status: 'done' as const, recipeId: end.recipeId, error: null }
    : { status: 'failed' as const, error: end.error };
  const r = await (await col()).updateOne({ _id, status: 'working' }, { $set: { ...set, doneAt: new Date().toISOString() } });
  return r.modifiedCount === 1;
}
