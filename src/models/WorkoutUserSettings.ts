import { UpdateFilter } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { WorkoutUserSettings, ExerciseLoadPref } from '@/types/workout';

// Per-user workout settings, one doc per user keyed by session email:
//   - bodyweightKg: current global bodyweight (feature 1), snapshotted onto
//     each workout at save time.
//   - exerciseLoad: per-exercise entry overrides (feature 2), keyed by
//     exerciseId (e.g. { 'bench-press': { entry: 'per-side', barWeightKg: 20 } }).
// Follows the typed-functions convention (no ODM wrapper), like WorkoutFeedPost.

const COLLECTION_NAME = 'workoutUserSettings';

interface WorkoutUserSettingsDocument {
  userId: string;
  bodyweightKg: number | null;
  exerciseLoad: Record<string, ExerciseLoadPref>;
}

const DEFAULT_SETTINGS: WorkoutUserSettings = { bodyweightKg: null, exerciseLoad: {} };

let indexEnsured: Promise<void> | null = null;

async function getCollection() {
  const client = await clientPromise;
  const col = client.db().collection<WorkoutUserSettingsDocument>(COLLECTION_NAME);
  if (!indexEnsured) {
    indexEnsured = col
      .createIndex({ userId: 1 }, { unique: true })
      .then(() => undefined)
      .catch((e) => {
        indexEnsured = null; // allow a later retry
        throw e;
      });
  }
  await indexEnsured;
  return col;
}

function toSettings(doc: WorkoutUserSettingsDocument | null): WorkoutUserSettings {
  if (!doc) return { ...DEFAULT_SETTINGS };
  return {
    bodyweightKg: doc.bodyweightKg ?? null,
    exerciseLoad: doc.exerciseLoad ?? {},
  };
}

// Read a user's settings, defaulting to today's behaviour when none exist.
export async function getUserSettings(userId: string): Promise<WorkoutUserSettings> {
  const col = await getCollection();
  const doc = await col.findOne({ userId });
  return toSettings(doc);
}

// Set the user's current global bodyweight (kg), or clear it with null.
export async function setBodyweight(
  userId: string,
  bodyweightKg: number | null,
): Promise<WorkoutUserSettings> {
  const col = await getCollection();
  const doc = await col.findOneAndUpdate(
    { userId },
    { $set: { bodyweightKg } },
    { upsert: true, returnDocument: 'after' },
  );
  return toSettings(doc);
}

// Set (or clear, with null) the user's per-exercise entry override. A dotted
// field path updates just the one exercise's entry inside the exerciseLoad map.
export async function setExerciseLoadPref(
  userId: string,
  exerciseId: string,
  pref: ExerciseLoadPref | null,
): Promise<WorkoutUserSettings> {
  const col = await getCollection();
  const field = `exerciseLoad.${exerciseId}`;
  const update: UpdateFilter<WorkoutUserSettingsDocument> = pref
    ? { $set: { [field]: pref } }
    : { $unset: { [field]: '' } };
  const doc = await col.findOneAndUpdate(
    { userId },
    update,
    { upsert: true, returnDocument: 'after' },
  );
  return toSettings(doc);
}
