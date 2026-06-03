import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { recomputeAndStorePersonalBests } from '@/lib/workout-pb';

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

    const workout = await WorkoutModel.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
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
