import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { recomputeAndStorePersonalBests } from '@/lib/workout-pb';
import { sanitizeExercisesStepIds } from '@/lib/workout-progression';
import { updateFeedPostWorkoutName } from '@/models/WorkoutFeedPost';
import { computeWorkoutStats } from '@/lib/workout-stats';
import { chooseBrag, type BragPick } from '@/lib/workout-brag';
import { bragFactsFor } from '@/lib/workout-brag-facts';
import type { Workout } from '@/types/workout';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;

  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Every handler must:
//  1) require a signed-in session
//  2) confirm the workout belongs to that user (so user A can't read or
//     mutate user B's data by guessing an id)
async function findOwnedWorkout(id: string, userEmail: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'Invalid workout ID', status: 400 };
  const workout = await WorkoutModel.findById(id).lean();
  if (!workout) return { error: 'Workout not found', status: 404 };
  if (workout.userId !== userEmail) {
    // Treat as 404 to avoid leaking existence of others' workouts.
    return { error: 'Workout not found', status: 404 };
  }
  return { workout };
}

// GET /api/workout/workouts/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();
    const { id } = await params;

    const result = await findOwnedWorkout(id, userId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const w = result.workout;
    return NextResponse.json({ ...w, id: w._id.toString(), _id: undefined });
  } catch (error) {
    console.error('Error fetching workout:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workout' },
      { status: 500 }
    );
  }
}

// PUT /api/workout/workouts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const owned = await findOwnedWorkout(id, userId);
    if ('error' in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }

    const updateData = { ...body };
    delete updateData._id;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.userId; // immutable: tied to the signed-in user
    // The joke is the server's pick (below); the client only reports its
    // local hour so the time-of-day jokes know when "late" is.
    delete updateData.brag;
    const localHour = typeof body.localHour === 'number' ? body.localHour : null;
    delete updateData.localHour;

    // Calisthenics: keep each set's stepId only if it names a real rung on
    // that exercise's ladder; unknown/stale ids drop to null. In place.
    if (updateData.exercises) sanitizeExercisesStepIds(updateData.exercises);

    const workout = await WorkoutModel.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    // First completion: pick the finish-workout joke once and store it, so
    // the summary, history and feed all show the same line. Re-completing a
    // resumed workout keeps its joke. Best-effort: no joke is not an error
    // (the UI falls back to a seeded one).
    if (workout.isCompleted && !owned.workout.isCompleted && !owned.workout.brag) {
      try {
        const brag = await pickBragFor(id, userId, workout as unknown as Workout, localHour);
        // Raw collection: `brag` is Mixed and server-owned, and a dev server's
        // cached model (HMR) may predate the field and strip it.
        await WorkoutModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { brag } });
        (workout as { brag?: BragPick }).brag = brag;
      } catch (bragError) {
        console.error('Brag pick after complete failed (non-fatal):', bragError);
      }
    }

    // A rename after sharing (freestyle "save as template") would otherwise
    // leave the feed post showing the old name — keep the post's name in step.
    // Best-effort like the PB refresh below; no-op if never shared.
    if (typeof updateData.workoutName === 'string' && workout.workoutName !== owned.workout.workoutName) {
      try {
        await updateFeedPostWorkoutName(id, workout.workoutName);
      } catch (feedError) {
        console.error('Feed post rename after workout rename failed (non-fatal):', feedError);
      }
    }

    // Refresh the materialized PB store only when the workout is now
    // completed (or was re-saved while completed) — not on every in-progress
    // autosave. Provisional in-progress sets don't count toward PB until the
    // workout is finished. Best-effort: the workout is already saved, so a
    // recompute failure must not fail the request (PB self-heals on the next
    // complete/delete); just log it.
    if (workout.isCompleted) {
      try {
        await recomputeAndStorePersonalBests(userId);
      } catch (pbError) {
        console.error('PB recompute after complete failed (non-fatal):', pbError);
      }
    }

    return NextResponse.json({ ...workout, id: workout._id.toString(), _id: undefined });
  } catch (error) {
    console.error('Error updating workout:', error);
    return NextResponse.json(
      { error: 'Failed to update workout' },
      { status: 500 }
    );
  }
}

// DELETE /api/workout/workouts/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();
    const { id } = await params;

    const owned = await findOwnedWorkout(id, userId);
    if ('error' in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }

    await WorkoutModel.findByIdAndDelete(id);
    // Deleting a workout can remove the set that held a PB → recompute + store.
    // Best-effort: the delete already committed, so don't fail on a recompute
    // error (PB self-heals on the next complete/delete).
    try {
      await recomputeAndStorePersonalBests(userId);
    } catch (pbError) {
      console.error('PB recompute after delete failed (non-fatal):', pbError);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workout:', error);
    return NextResponse.json(
      { error: 'Failed to delete workout' },
      { status: 500 }
    );
  }
}

// How many past jokes the picker steers away from.
const BRAG_MEMORY = 15;

async function pickBragFor(id: string, userId: string, workout: Workout, localHour: number | null): Promise<BragPick> {
  const others = { userId, isCompleted: true, _id: { $ne: new mongoose.Types.ObjectId(id) } };
  const [recentDocs, prev] = await Promise.all([
    WorkoutModel.collection
      .find({ ...others, brag: { $exists: true } }, { projection: { brag: 1 }, sort: { updatedAt: -1 }, limit: BRAG_MEMORY })
      .toArray(),
    WorkoutModel.findOne(others, { exercises: 1, bodyweightKg: 1 })
      .sort({ date: -1, createdAt: -1 }).lean(),
  ]);
  const recent = recentDocs.map((d) => d.brag as BragPick | undefined).filter((b): b is BragPick => !!b);
  const prevVolumeKg = prev ? computeWorkoutStats(prev).totalVolumeKg : null;
  return chooseBrag(bragFactsFor(workout, { prevVolumeKg, localHour }), recent);
}
