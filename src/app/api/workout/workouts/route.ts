import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { UserId, WorkoutType } from '@/types/workout';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// GET /api/workout/workouts?userId=tom
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') as UserId | null;
    
    if (!userId || !['tom', 'tomer'].includes(userId)) {
      return NextResponse.json(
        { error: 'Valid userId is required (tom or tomer)' },
        { status: 400 }
      );
    }
    
    const workouts = await WorkoutModel.find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    
    // Transform _id to id
    const transformedWorkouts = workouts.map(w => ({
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
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { userId, workoutType, date } = body as {
      userId: UserId;
      workoutType: WorkoutType;
      date: string;
    };
    
    if (!userId || !['tom', 'tomer'].includes(userId)) {
      return NextResponse.json(
        { error: 'Valid userId is required (tom or tomer)' },
        { status: 400 }
      );
    }
    
    if (!workoutType) {
      return NextResponse.json(
        { error: 'workoutType is required' },
        { status: 400 }
      );
    }
    
    const workout = new WorkoutModel({
      userId,
      workoutType,
      date: date || new Date().toISOString().split('T')[0],
      exercises: [],
      isCompleted: false,
    });
    
    await workout.save();
    
    const result = workout.toJSON();
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating workout:', error);
    return NextResponse.json(
      { error: 'Failed to create workout' },
      { status: 500 }
    );
  }
}
