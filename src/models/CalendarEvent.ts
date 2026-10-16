import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { SEED_EVENTS, type CalendarEvent, type CalendarEventInput } from '@/lib/calendar';

const COLLECTION_NAME = 'calendarEvents';
// Private to this model: holds only the one-time seed marker.
const META_COLLECTION_NAME = 'calendarMeta';
const SEED_MARKER_ID = 'seed-v1';

interface CalendarEventDocument extends Omit<CalendarEvent, 'id'> {
  _id?: ObjectId;
}

interface CalendarMetaDocument {
  _id: string;
  at: string;
}

async function getDb() {
  const client = await clientPromise;
  return client.db();
}

export async function getCalendarEventsCollection() {
  return (await getDb()).collection<CalendarEventDocument>(COLLECTION_NAME);
}

function docToEvent(doc: CalendarEventDocument): CalendarEvent {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toString() };
}

let seededInThisProcess = false;

// Fixed ids make seeding idempotent: re-running it can never duplicate a seed.
const seedId = (index: number) => new ObjectId(`ca1e${String(index).padStart(20, '0')}`);

// Seeds SEED_EVENTS once. Each seed is upserted under its fixed id (safe to
// retry, safe when two first loads race), and only then is the marker written.
// So a failed first attempt is retried on the next GET, and once the marker
// exists, deleting a seeded event keeps it deleted.
async function ensureSeeded(): Promise<void> {
  if (seededInThisProcess) return;
  const meta = (await getDb()).collection<CalendarMetaDocument>(META_COLLECTION_NAME);
  if (await meta.findOne({ _id: SEED_MARKER_ID })) {
    seededInThisProcess = true;
    return;
  }

  const collection = await getCalendarEventsCollection();
  const now = new Date().toISOString();
  await Promise.all(
    SEED_EVENTS.map((seed, i) =>
      collection
        .updateOne(
          { _id: seedId(i) },
          { $setOnInsert: { ...seed, createdBy: 'seed', createdAt: now, updatedAt: now } },
          { upsert: true },
        )
        .catch((error: { code?: number }) => {
          // A concurrent first load upserted the same id first: already seeded.
          if (error.code !== 11000) throw error;
        }),
    ),
  );
  await meta.updateOne({ _id: SEED_MARKER_ID }, { $setOnInsert: { at: now } }, { upsert: true });
  seededInThisProcess = true;
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  await ensureSeeded();
  const collection = await getCalendarEventsCollection();
  const docs = await collection.find({}).sort({ date: 1 }).toArray();
  return docs.map(docToEvent);
}

export async function createCalendarEvent(
  input: CalendarEventInput,
  createdBy: string,
): Promise<CalendarEvent> {
  const collection = await getCalendarEventsCollection();
  const now = new Date().toISOString();
  const doc: Omit<CalendarEventDocument, '_id'> = { ...input, createdBy, createdAt: now, updatedAt: now };
  const result = await collection.insertOne(doc);
  return { ...doc, id: result.insertedId.toString() };
}

// Full replace of the editable fields: an emoji or note left out is cleared.
export async function updateCalendarEvent(
  id: string,
  input: CalendarEventInput,
): Promise<CalendarEvent | null> {
  const collection = await getCalendarEventsCollection();
  const { emoji, note, ...required } = input;
  const unset: Record<string, ''> = {};
  if (emoji === undefined) unset.emoji = '';
  if (note === undefined) unset.note = '';
  const doc = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...required,
        ...(emoji !== undefined && { emoji }),
        ...(note !== undefined && { note }),
        updatedAt: new Date().toISOString(),
      },
      ...(Object.keys(unset).length > 0 && { $unset: unset }),
    },
    { returnDocument: 'after' },
  );
  return doc ? docToEvent(doc) : null;
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  const collection = await getCalendarEventsCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
