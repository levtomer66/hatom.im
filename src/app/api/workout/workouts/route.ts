import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { personalBestsTag } from '@/lib/workout-cache';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;

  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// GET /api/workout/workouts
// userId is derived from the Auth.js session; any client-supplied
// userId query string is ignored. Each user only sees their own
// workouts after the PR 4 SSO migration.
//
// Returns lightweight WorkoutSummary docs (no `exercises` array) via a
// server-side projection — the full set data of every workout was the
// dominant cold-load payload. Consumers that need the full document
// (active-workout resume, history detail) fetch GET /workouts/[id].
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();

    // $project with $size(exercises) instead of returning the array —
    // Mongo computes the count server-side so the payload is a handful
    // of scalars per workout regardless of how many sets were logged.
    const workouts = await WorkoutModel.aggregate([
      { $match: { userId } },
      { $sort: { date: -1, createdAt: -1 } },
      {
        $project: {
          workoutName: 1,
          date: 1,
          isCompleted: 1,
          templateId: 1,
          createdAt: 1,
          updatedAt: 1,
          exerciseCount: { $size: { $ifNull: ['$exercises', []] } },
        },
      },
    ]);

    const summaries = workouts.map((w) => ({
      id: w._id.toString(),
      userId,
      workoutName: w.workoutName,
      date: w.date,
      isCompleted: !!w.isCompleted,
      templateId: w.templateId ?? null,
      exerciseCount: w.exerciseCount ?? 0,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workouts' },
      { status: 500 }
    );
  }
}

// POST /api/workout/workouts
// userId is derived from the session; any client-supplied userId in the
// body is ignored.
export async function POST(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();

    const body = await request.json();
    const { templateId, workoutName, date, clientRequestId } = body as {
      templateId?: string;
      workoutName: string;
      date: string;
      clientRequestId?: string;
    };

    if (!workoutName) {
      return NextResponse.json(
        { error: 'workoutName is required' },
        { status: 400 }
      );
    }

    // Idempotency: if the client provides a clientRequestId and we've
    // already created a workout with the same (userId, clientRequestId),
    // return it instead of creating a duplicate. Locks in the PWA
    // offline-queue's safety — a replay after the original PUT succeeded
    // but the response was lost won't create a phantom workout.
    if (clientRequestId) {
      const existing = await WorkoutModel.findOne({ userId, clientRequestId }).lean();
      if (existing) {
        return NextResponse.json(
          { ...existing, id: existing._id.toString(), _id: undefined },
          { status: 200 },
        );
      }
    }

    // Note: `clientRequestId` is OMITTED (not set to null) when the client
    // didn't supply one. A sparse unique index on the field still indexes
    // documents where the field exists with a null value, so storing
    // `null` would cause every workout-after-the-first to collide on the
    // duplicate-key check. Only include the field when there's a real
    // UUID to dedupe against. (Codex P0)
    const workoutData: Record<string, unknown> = {
      userId,
      templateId: templateId || null,
      workoutName,
      date: date || new Date().toISOString().split('T')[0],
      exercises: [],
      isCompleted: false,
    };
    if (clientRequestId) workoutData.clientRequestId = clientRequestId;
    const workout = new WorkoutModel(workoutData);

    await workout.save();

    // A new workout can change the user's PBs (its sets feed the e1RM
    // computation), so drop the cached PB map for this user.
    revalidateTag(personalBestsTag(userId));

    return NextResponse.json(workout.toJSON(), { status: 201 });
  } catch (error) {
    console.error('Error creating workout:', error);
    return NextResponse.json(
      { error: 'Failed to create workout' },
      { status: 500 }
    );
  }
}
