import { Collection } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import {
  JourneyPhoto,
  TripJourneyDay,
  TripJourneySummary,
  UNASSIGNED_DAY,
} from '@/types/trip';

const COLLECTION_NAME = 'tripJourney';

async function getCollection(): Promise<Collection<TripJourneyDay>> {
  const client = await clientPromise;
  return client.db().collection<TripJourneyDay>(COLLECTION_NAME);
}

// Fetch a single day document. Returns null when no photos have been
// uploaded for that date yet — callers treat null as "empty day".
export async function getJourneyDay(dayDate: string): Promise<TripJourneyDay | null> {
  const col = await getCollection();
  const doc = await col.findOne({ dayDate });
  if (!doc) return null;
  // Sort photos within the day by takenAt so the day modal renders in
  // chronological order regardless of upload order.
  return {
    ...doc,
    photos: [...doc.photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
  };
}

// All days that have at least one photo, compact shape for calendar badges.
export async function getAllJourneySummaries(): Promise<{
  days: TripJourneySummary[];
  unassignedCount: number;
}> {
  const col = await getCollection();
  const docs = await col.find({}).toArray();

  let unassignedCount = 0;
  const days: TripJourneySummary[] = [];
  for (const d of docs) {
    if (d.dayDate === UNASSIGNED_DAY) {
      unassignedCount = d.photos.length;
      continue;
    }
    // Skip documents with no photos. A day doc can exist with empty
    // photos[] after saving a note on an empty day, or after deleting the
    // last photo. Without this guard the frontend renders `📸 0` badges
    // and the API's stated contract ("days with photos") is broken.
    if (d.photos.length === 0) continue;
    days.push({
      dayDate: d.dayDate,
      photoCount: d.photos.length,
      hasNote: Boolean(d.note && d.note.length > 0),
      thumbnailUrl: d.photos[0]?.blobUrl,
    });
  }
  // Sort for a stable response order.
  days.sort((a, b) => a.dayDate.localeCompare(b.dayDate));
  return { days, unassignedCount };
}

// Append a photo to the target day's document (upsert the doc if it's the
// first photo for that date). Called from POST /api/trip/journey/upload.
export async function appendPhoto(
  dayDate: string,
  photo: JourneyPhoto
): Promise<TripJourneyDay> {
  const col = await getCollection();
  const now = new Date().toISOString();
  const result = await col.findOneAndUpdate(
    { dayDate },
    {
      $push: { photos: photo },
      $set: { updatedAt: now },
      $setOnInsert: { dayDate, createdAt: now, note: '' },
    },
    { upsert: true, returnDocument: 'after' }
  );
  if (!result) {
    // findOneAndUpdate with upsert and returnDocument: 'after' should always
    // return the document. Defensive: re-fetch.
    const doc = await col.findOne({ dayDate });
    if (!doc) throw new Error('appendPhoto: failed to upsert day document');
    return doc;
  }
  return result;
}

// Update the free-text note on a day.
export async function updateDayNote(
  dayDate: string,
  note: string
): Promise<TripJourneyDay | null> {
  const col = await getCollection();
  const now = new Date().toISOString();
  const result = await col.findOneAndUpdate(
    { dayDate },
    {
      $set: { note, updatedAt: now },
      $setOnInsert: { dayDate, createdAt: now, photos: [] },
    },
    { upsert: true, returnDocument: 'after' }
  );
  return result ?? null;
}

// Remove a photo by its blobPath (stable identifier inside the day's array).
// Returns the deleted entry so the caller can `del()` from Blob storage.
export async function removePhotoByBlobPath(
  dayDate: string,
  blobPath: string
): Promise<JourneyPhoto | null> {
  const col = await getCollection();
  const doc = await col.findOne({ dayDate });
  if (!doc) return null;
  const removed = doc.photos.find(p => p.blobPath === blobPath) ?? null;
  if (!removed) return null;
  await col.updateOne(
    { dayDate },
    {
      $pull: { photos: { blobPath } },
      $set: { updatedAt: new Date().toISOString() },
    }
  );
  return removed;
}

// Move a photo out of the unassigned bucket onto a concrete day.
export async function reassignPhoto(
  fromDay: string,
  toDay: string,
  blobPath: string
): Promise<JourneyPhoto | null> {
  const removed = await removePhotoByBlobPath(fromDay, blobPath);
  if (!removed) return null;
  await appendPhoto(toDay, removed);
  return removed;
}

export { UNASSIGNED_DAY };
