import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { requireSignedIn } from '@/lib/auth-helpers';

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
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();

    const workouts = await WorkoutModel.find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const transformedWorkouts = workouts.map((w) => ({
      ...w,
      id: w._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json(transformedWorkouts);
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
    const { templateId, workoutName, date } = body as {
      templateId?: string;
      workoutName: string;
      date: string;
    };

    if (!workoutName) {
      return NextResponse.json(
        { error: 'workoutName is required' },
        { status: 400 }
      );
    }

    const workout = new WorkoutModel({
      userId,
      templateId: templateId || null,
      workoutName,
      date: date || new Date().toISOString().split('T')[0],
      exercises: [],
      isCompleted: false,
    });

    await workout.save();

    return NextResponse.json(workout.toJSON(), { status: 201 });
  } catch (error) {
    console.error('Error creating workout:', error);
    return NextResponse.json(
      { error: 'Failed to create workout' },
      { status: 500 }
    );
  }
}
