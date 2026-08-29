import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { WorkoutStats } from '@/lib/workout-stats';

// Motivation feed: one shared, completed workout. A post is a server-computed
// SNAPSHOT taken at share time — the feed never joins the workouts collection,
// so a post survives later edits/deletion of its workout. The brag line is NOT
// stored: getVolumeBrag(totalVolumeKg, language, workoutId) is deterministic,
// so the feed recomputes it in each viewer's own language.
//
// Ordering invariant: the feed sorts by when the workout HAPPENED
// (workoutDate desc, then workoutStartedAt desc), never by `sharedAt` — a
// retro-shared old workout slots into its own date, it does not jump to top.

const COLLECTION_NAME = 'workoutFeedPosts';

export interface WorkoutFeedPost {
  id: string;
  userId: string;              // session email of the sharer == workout owner
  workoutId: string;           // unique — one post per workout
  workoutName: string;         // canonical (English) name; localized at render
  workoutDate: string;         // Workout.date (YYYY-MM-DD) — primary sort key
  workoutStartedAt: string;    // Workout.createdAt (ISO) — sort tiebreaker
  stats: WorkoutStats;
  sharedAt: string;            // ISO, audit only — NEVER used for ordering
}

export type CreateWorkoutFeedPost = Omit<WorkoutFeedPost, 'id' | 'sharedAt'>;

interface WorkoutFeedPostDocument extends Omit<WorkoutFeedPost, 'id'> {
  _id?: ObjectId;
}

let indexesEnsured: Promise<void> | null = null;

async function getCollection() {
  const client = await clientPromise;
  const col = client.db().collection<WorkoutFeedPostDocument>(COLLECTION_NAME);
  if (!indexesEnsured) {
    // One post per workout; feed query orders by the workout's own time.
    indexesEnsured = Promise.all([
      col.createIndex({ workoutId: 1 }, { unique: true }),
      col.createIndex({ workoutDate: -1, workoutStartedAt: -1 }),
    ])
      .then(() => undefined)
      .catch((e) => {
        indexesEnsured = null; // allow a later retry
        throw e;
      });
  }
  await indexesEnsured;
  return col;
}

function toPost(doc: WorkoutFeedPostDocument): WorkoutFeedPost {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toString() };
}

// One page of the feed, newest WORKOUT first (not newest share).
export async function getFeedPage(limit: number, skip: number): Promise<WorkoutFeedPost[]> {
  const col = await getCollection();
  const docs = await col
    .find({})
    .sort({ workoutDate: -1, workoutStartedAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  return docs.map(toPost);
}

// Lookup by workoutId — powers the share-state check on completion/history.
export async function getFeedPostByWorkoutId(workoutId: string): Promise<WorkoutFeedPost | null> {
  const col = await getCollection();
  const doc = await col.findOne({ workoutId });
  return doc ? toPost(doc) : null;
}

// Insert a snapshot. Throws on the unique index if the workout is already
// shared (the route pre-checks and maps that to 409). `sharedAt` is stamped
// here and is audit-only.
export async function createFeedPost(data: CreateWorkoutFeedPost): Promise<WorkoutFeedPost> {
  const col = await getCollection();
  const doc: WorkoutFeedPostDocument = { ...data, sharedAt: new Date().toISOString() };
  const result = await col.insertOne(doc);
  return toPost({ ...doc, _id: result.insertedId });
}

// Remove a post — own posts only (route enforces ownership by passing userId).
// Returns true when a post was deleted.
export async function deleteFeedPost(workoutId: string, userId: string): Promise<boolean> {
  const col = await getCollection();
  const result = await col.deleteOne({ workoutId, userId });
  return result.deletedCount === 1;
}
