import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { applyStopsChange, type Trip, type TripCreate, type TripPatch } from '@/lib/shopping/trips';

// Shopping trips (docs/shopping-in-store-mode.md): a plan taken into the
// store. One open trip per list; anyone who can see the list can join it,
// so the routes check the list's visibility before calling these. Ticks are
// a set of item keys (`ticked`) plus an append-only `tickLog` kept for
// learning a branch's aisle order later.
const COLLECTION_NAME = 'shoppingTrips';

interface TripDocument extends Omit<Trip, 'id' | 'notThere'> {
  _id?: ObjectId;
  notThere?: string[];
  tickLog: { key: string; by: string; at: string }[];
  /** Bumped on every change to `stops`, so two people's swaps can't overwrite each other. */
  rev?: number;
}

async function getCollection() {
  const col = (await clientPromise).db().collection<TripDocument>(COLLECTION_NAME);
  return col;
}

function docToTrip(doc: TripDocument): Trip {
  const { _id, tickLog: _log, rev: _rev, ...rest } = doc;
  void _log;
  void _rev;
  return { ...rest, notThere: doc.notThere ?? [], id: _id!.toString() };
}

export async function getOpenTrip(listId: string): Promise<Trip | null> {
  const doc = await (await getCollection()).findOne({ listId, endedAt: null }, { sort: { startedAt: -1 } });
  return doc ? docToTrip(doc) : null;
}

export async function getTrip(id: string): Promise<Trip | null> {
  const doc = await (await getCollection()).findOne({ _id: new ObjectId(id) });
  return doc ? docToTrip(doc) : null;
}

/** The list's open trip if there is one (someone already started), else a new one. */
export async function startTrip(input: TripCreate, by: string): Promise<{ trip: Trip; created: boolean }> {
  const open = await getOpenTrip(input.listId);
  if (open) return { trip: open, created: false };
  const doc: Omit<TripDocument, '_id'> = {
    ...input, ticked: [], notThere: [], tickLog: [], rev: 0, startedBy: by, startedAt: new Date().toISOString(), endedAt: null,
  };
  const res = await (await getCollection()).insertOne(doc);
  return { trip: docToTrip({ ...doc, _id: res.insertedId }), created: true };
}

/** Tick or untick one item on an open trip. Null when the trip is missing or already ended. */
export async function setTick(id: string, key: string, on: boolean, by: string): Promise<Trip | null> {
  const update = on
    ? { $addToSet: { ticked: key }, $push: { tickLog: { key, by, at: new Date().toISOString() } } }
    : { $pull: { ticked: key } };
  const doc = await (await getCollection()).findOneAndUpdate(
    { _id: new ObjectId(id), endedAt: null, 'stops.items.key': key },
    update,
    { returnDocument: 'after' },
  );
  return doc ? docToTrip(doc) : null;
}

/** Mark an item "לא היה" (or take that back). */
export async function setNotThere(id: string, key: string, on: boolean): Promise<Trip | null> {
  const doc = await (await getCollection()).findOneAndUpdate(
    { _id: new ObjectId(id), endedAt: null, 'stops.items.key': key },
    on ? { $addToSet: { notThere: key } } : { $pull: { notThere: key } },
    { returnDocument: 'after' },
  );
  return doc ? docToTrip(doc) : null;
}

/**
 * Swap, move or re-quantify an item: read, change in JS, write back only if
 * nobody changed the stops meanwhile (retried a few times). The swapped-out
 * item's tick and "לא היה" go with it. Null when the change doesn't apply.
 */
export async function changeStops(
  id: string,
  p: Extract<TripPatch, { replace: unknown } | { move: unknown } | { qty: unknown }>,
): Promise<Trip | null> {
  const col = await getCollection();
  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await col.findOne({ _id: new ObjectId(id), endedAt: null });
    if (!doc) return null;
    const stops = applyStopsChange(doc.stops, p);
    if (!stops) return null;
    const rev = doc.rev ?? 0;
    const pullOld = 'replace' in p ? { $pull: { ticked: p.replace.key, notThere: p.replace.key } } : {};
    const res = await col.findOneAndUpdate(
      { _id: doc._id, endedAt: null, ...(doc.rev === undefined ? { rev: { $exists: false } } : { rev }) },
      { $set: { stops, rev: rev + 1 }, ...pullOld },
      { returnDocument: 'after' },
    );
    if (res) return docToTrip(res);
  }
  return null;
}

export async function endTrip(id: string): Promise<Trip | null> {
  const doc = await (await getCollection()).findOneAndUpdate(
    { _id: new ObjectId(id), endedAt: null },
    { $set: { endedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  return doc ? docToTrip(doc) : null;
}

/**
 * Item keys bought on the lists' recent trips (ticked), most recent trip
 * first, for "קנית בעבר" in "אני בסופר". Reads only `ticked` of the last
 * `trips` trips.
 */
export async function getRecentTicked(listIds: string[], trips = 20): Promise<string[]> {
  if (!listIds.length) return [];
  const docs = await (await getCollection())
    .find({ listId: { $in: listIds } }, { projection: { ticked: 1 } })
    .sort({ startedAt: -1 })
    .limit(trips)
    .toArray();
  return [...new Set(docs.flatMap((d) => d.ticked ?? []))];
}
