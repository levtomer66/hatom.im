import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { getUserDisplayName } from '@/types/workout';
import { computeWorkoutStats } from '@/lib/workout-stats';
import {
  getFeedPage,
  getFeedPostByWorkoutId,
  createFeedPost,
  WorkoutFeedPost,
} from '@/models/WorkoutFeedPost';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Attach the sharer's display name, resolved server-side.
function withDisplayName(post: WorkoutFeedPost) {
  return { ...post, displayName: getUserDisplayName(post.userId) };
}

// GET /api/workout/feed
//   ?workoutId=<id>       → { shared: boolean } for the share-state check
//   ?limit=N&skip=M       → one page of the feed, newest WORKOUT first
// Any signed-in user sees the whole group's feed.
export async function GET(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;

  try {
    const params = new URL(request.url).searchParams;

    // Share-state probe for a single workout (history/completion buttons).
    const workoutId = params.get('workoutId');
    if (workoutId) {
      const post = await getFeedPostByWorkoutId(workoutId);
      return NextResponse.json({ shared: post !== null });
    }

    const limitRaw = params.get('limit');
    const skipRaw = params.get('skip');
    const limit = limitRaw !== null ? Math.min(Math.max(parseInt(limitRaw, 10) || 0, 1), 50) : 30;
    const skip = skipRaw !== null ? Math.max(parseInt(skipRaw, 10) || 0, 0) : 0;

    const posts = await getFeedPage(limit, skip);
    return NextResponse.json(posts.map(withDisplayName));
  } catch (error) {
    console.error('Error fetching feed:', error);
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
}

// POST /api/workout/feed  { workoutId }
// Shares a completed workout the caller owns. The stats are a server-computed
// snapshot; the client can't inject numbers.
export async function POST(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const body = await request.json();
    const workoutId: unknown = body?.workoutId;
    if (typeof workoutId !== 'string' || !mongoose.Types.ObjectId.isValid(workoutId)) {
      return NextResponse.json({ error: 'Invalid workoutId' }, { status: 400 });
    }

    await connectDB();
    const workout = await WorkoutModel.findById(workoutId).lean();
    if (!workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }
    if (workout.userId !== userId) {
      return NextResponse.json({ error: 'Not your workout' }, { status: 403 });
    }
    if (!workout.isCompleted) {
      return NextResponse.json({ error: 'Workout is not completed' }, { status: 400 });
    }

    // Already shared? Idempotent-friendly: report the conflict, don't dupe.
    const existing = await getFeedPostByWorkoutId(workoutId);
    if (existing) {
      return NextResponse.json({ error: 'Already shared', post: withDisplayName(existing) }, { status: 409 });
    }

    const stats = computeWorkoutStats(workout);
    const post = await createFeedPost({
      userId,
      workoutId,
      workoutName: workout.workoutName,
      workoutDate: workout.date,
      // createdAt is always present (schema timestamps), but fall back to the
      // workout date so a legacy/odd doc can't throw on an invalid Date.
      workoutStartedAt: workout.createdAt
        ? new Date(workout.createdAt).toISOString()
        : new Date(workout.date).toISOString(),
      stats,
    });
    return NextResponse.json(withDisplayName(post), { status: 201 });
  } catch (error) {
    // A racing double-share trips the unique index — treat as already shared.
    if (error && typeof error === 'object' && (error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'Already shared' }, { status: 409 });
    }
    console.error('Error sharing workout:', error);
    return NextResponse.json({ error: 'Failed to share workout' }, { status: 500 });
  }
}
