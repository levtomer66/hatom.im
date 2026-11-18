import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import CustomExerciseModel from '@/models/CustomExercise';
import { requireSignedIn } from '@/lib/auth-helpers';
import { deleteFeedPost, getFeedPostByWorkoutId, isSetsShared } from '@/models/WorkoutFeedPost';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

// GET /api/workout/feed/[workoutId]
// The logged sets behind a feed post, for any signed-in user — but only when
// the post exists and its sharer left "Include logged sets" on. Reads the
// workout live, so later fixes in history show up here too. Custom exercises
// belong to the sharer, so their names ride along (`customExercises`).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workoutId: string }> },
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;

  try {
    const { workoutId } = await params;
    const post = await getFeedPostByWorkoutId(workoutId);
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (!isSetsShared(post)) return NextResponse.json({ error: 'Sets not shared' }, { status: 403 });
    if (!mongoose.Types.ObjectId.isValid(workoutId)) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    await connectDB();
    const workout = await WorkoutModel.findById(workoutId, { exercises: 1, bodyweightKg: 1, userId: 1 }).lean();
    // The post outlived its workout, or (never expected) they disagree on owner.
    if (!workout || workout.userId !== post.userId) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    const ids = [...new Set(workout.exercises.map((e) => e.exerciseId))];
    const customs = await CustomExerciseModel.find(
      { userId: post.userId, exerciseId: { $in: ids } },
      { exerciseId: 1, name: 1 },
    ).lean();

    return NextResponse.json({
      exercises: workout.exercises,
      bodyweightKg: workout.bodyweightKg ?? null,
      customExercises: customs.map((c) => ({ id: c.exerciseId, name: c.name })),
    });
  } catch (error) {
    console.error('Error fetching shared sets:', error);
    return NextResponse.json({ error: 'Failed to fetch sets' }, { status: 500 });
  }
}

// DELETE /api/workout/feed/[workoutId]
// Unshare — own posts only. Re-sharing afterward is allowed and refreshes the
// snapshot (there is no edit endpoint; unshare + reshare is the escape hatch).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workoutId: string }> },
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const { workoutId } = await params;
    const deleted = await deleteFeedPost(workoutId, userId);
    if (!deleted) {
      // Either it didn't exist or it isn't the caller's — 404 either way so we
      // don't leak the existence of another user's post.
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unsharing workout:', error);
    return NextResponse.json({ error: 'Failed to unshare' }, { status: 500 });
  }
}
