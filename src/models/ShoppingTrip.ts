import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { Trip, TripCreate } from '@/lib/shopping/trips';

// Shopping trips (docs/shopping-in-store-mode.md): a plan taken into the
// store. One open trip per list; anyone who can see the list can join it,
// so the routes check the list's visibility before calling these. Ticks are
// a set of item keys (`ticked`) plus an append-only `tickLog` kept for
// learning a branch's aisle order later.
const COLLECTION_NAME = 'shoppingTrips';

interface TripDocument extends Omit<Trip, 'id'> {
  _id?: ObjectId;
  tickLog: { key: string; by: string; at: string }[];
}

async function getCollection() {
  const col = (await clientPromise).db().collection<TripDocument>(COLLECTION_NAME);
  return col;
}

function docToTrip(doc: TripDocument): Trip {
  const { _id, tickLog: _log, ...rest } = doc;
  void _log;
  return { ...rest, id: _id!.toString() };
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
    ...input, ticked: [], tickLog: [], startedBy: by, startedAt: new Date().toISOString(), endedAt: null, paid: null,
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

export async function endTrip(id: string, paid: number | null): Promise<Trip | null> {
  const doc = await (await getCollection()).findOneAndUpdate(
    { _id: new ObjectId(id), endedAt: null },
    { $set: { endedAt: new Date().toISOString(), paid } },
    { returnDocument: 'after' },
  );
  return doc ? docToTrip(doc) : null;
}
