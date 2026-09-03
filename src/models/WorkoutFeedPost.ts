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
  likes: string[];             // session emails that liked this post; count = length
}

// Callers never set id/sharedAt/likes: id + sharedAt are stamped on insert and
// likes always start empty.
export type CreateWorkoutFeedPost = Omit<WorkoutFeedPost, 'id' | 'sharedAt' | 'likes'>;

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
  // Legacy posts predate the likes field — default to an empty array so callers
  // never have to null-check.
  return { ...rest, likes: rest.likes ?? [], id: _id!.toString() };
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

// Group-wide totals that drive "The Moving Car" (see src/lib/workout-car.ts):
// the sum of every post's snapshot volume, overall and per sharer. One
// $group over the collection — the car's level/progress is derived from
// `totalKg` by a pure function, so nothing about it is stored here.
export interface FeedTotals {
  totalKg: number;
  postCount: number;
  byUser: { userId: string; kg: number; posts: number }[]; // heaviest pusher first
}

export async function getFeedTotals(): Promise<FeedTotals> {
  const col = await getCollection();
  const rows = await col
    .aggregate<{ _id: string; kg: number; posts: number }>([
      {
        $group: {
          _id: '$userId',
          kg: { $sum: { $ifNull: ['$stats.totalVolumeKg', 0] } },
          posts: { $sum: 1 },
        },
      },
      { $sort: { kg: -1, _id: 1 } },
    ])
    .toArray();

  let totalKg = 0;
  let postCount = 0;
  const byUser = rows.map((r) => {
    const kg = Number.isFinite(r.kg) ? r.kg : 0;
    totalKg += kg;
    postCount += r.posts;
    return { userId: r._id, kg, posts: r.posts };
  });
  return { totalKg, postCount, byUser };
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
  const doc: WorkoutFeedPostDocument = { ...data, sharedAt: new Date().toISOString(), likes: [] };
  const result = await col.insertOne(doc);
  return toPost({ ...doc, _id: result.insertedId });
}

// Keep a post's displayed name in step with an explicit rename of its workout
// (a freestyle workout saved as a template after completion gets its chosen
// name). Stats remain a snapshot. No-op when the workout was never shared.
export async function updateFeedPostWorkoutName(workoutId: string, workoutName: string): Promise<void> {
  const col = await getCollection();
  await col.updateOne({ workoutId }, { $set: { workoutName } });
}

// Toggle the caller's like on a post and return the post-toggle count + whether
// the caller now likes it, or null if the post doesn't exist. Owner-can't-like
// is enforced by the route, not here. The add-if-absent / remove-if-present
// decision runs inside a single aggregation-pipeline update, so it's atomic —
// no read-decide-write race, and a vanished post surfaces as a null result
// (→ 404) rather than a fake zero count.
export async function toggleLike(
  workoutId: string,
  userId: string,
): Promise<{ likeCount: number; likedByMe: boolean } | null> {
  const col = await getCollection();
  const updated = await col.findOneAndUpdate(
    { workoutId },
    [
      {
        $set: {
          likes: {
            $let: {
              vars: { cur: { $ifNull: ['$likes', []] } },
              in: {
                $cond: [
                  { $in: [userId, '$$cur'] },
                  { $setDifference: ['$$cur', [userId]] },
                  { $concatArrays: ['$$cur', [userId]] },
                ],
              },
            },
          },
        },
      },
    ],
    { returnDocument: 'after' },
  );
  if (!updated) return null;
  const likes = updated.likes ?? [];
  return { likeCount: likes.length, likedByMe: likes.includes(userId) };
}

// Remove a post — own posts only (route enforces ownership by passing userId).
// Returns true when a post was deleted.
export async function deleteFeedPost(workoutId: string, userId: string): Promise<boolean> {
  const col = await getCollection();
  const result = await col.deleteOne({ workoutId, userId });
  return result.deletedCount === 1;
}
