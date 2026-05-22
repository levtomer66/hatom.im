import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import CustomExerciseModel from '@/models/CustomExercise';
import { ExerciseCategory, ExerciseDefinition } from '@/types/workout';
import { v4 as uuidv4 } from 'uuid';
import { requireSignedIn } from '@/lib/auth-helpers';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;

  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// GET /api/workout/exercises/custom
// Returns all custom exercises for the signed-in user.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();

    const customExercises = await CustomExerciseModel.find({ userId }).lean();

    const exercises: ExerciseDefinition[] = customExercises.map((e) => ({
      id: e.exerciseId,
      name: e.name,
      categories: e.categories as ExerciseCategory[],
      defaultPhoto: e.photo,
      isCustom: true,
    }));

    return NextResponse.json(exercises);
  } catch (error) {
    console.error('Error fetching custom exercises:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom exercises' },
      { status: 500 }
    );
  }
}

// POST /api/workout/exercises/custom
// Create a new custom exercise for the signed-in user.
export async function POST(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();

    const body = await request.json();
    const { name, categories, photo } = body as {
      name: string;
      categories: ExerciseCategory[];
      photo?: string;
    };

    if (!name || !categories || categories.length === 0) {
      return NextResponse.json(
        { error: 'Name and at least one category are required' },
        { status: 400 }
      );
    }

    const exerciseId = `custom-${uuidv4().substring(0, 8)}`;

    const customExercise = new CustomExerciseModel({
      userId,
      exerciseId,
      name,
      categories,
      photo: photo || null,
    });

    await customExercise.save();

    const result: ExerciseDefinition = {
      id: exerciseId,
      name,
      categories,
      defaultPhoto: photo,
      isCustom: true,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating custom exercise:', error);
    return NextResponse.json(
      { error: 'Failed to create custom exercise' },
      { status: 500 }
    );
  }
}
