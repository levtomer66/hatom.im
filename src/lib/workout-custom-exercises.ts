import mongoose from 'mongoose';
import CustomExerciseModel, { CustomExerciseDocument } from '@/models/CustomExercise';
import { ExerciseCategory, ExerciseDefinition } from '@/types/workout';
import { v4 as uuidv4 } from 'uuid';

// Shared data access for per-user custom exercises — used by both the
// /api/workout/exercises/custom route and the /bootstrap aggregator so the
// shape stays identical and the bootstrap pays no extra round trip.

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Mongo doc → the client-facing ExerciseDefinition shape. `isCustom` lets the
// UI tag the row and sort customs first; defaultPhoto falls back to the 🏋️
// placeholder via ExercisePhoto when absent.
function toDefinition(e: Pick<CustomExerciseDocument, 'exerciseId' | 'name' | 'categories' | 'photo'>): ExerciseDefinition {
  return {
    id: e.exerciseId,
    name: e.name,
    categories: e.categories as ExerciseCategory[],
    defaultPhoto: e.photo ?? undefined,
    isCustom: true,
  };
}

export async function listCustomExercises(userId: string): Promise<ExerciseDefinition[]> {
  await connectDB();
  const docs = await CustomExerciseModel.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
  return docs.map(toDefinition);
}

export async function createCustomExercise(
  userId: string,
  input: { name: string; categories: ExerciseCategory[]; photo?: string | null },
): Promise<ExerciseDefinition> {
  await connectDB();
  // `custom-<8 hex>` — same id scheme the original feature used, so any
  // history written before the feature was retired still resolves. The
  // collection has a unique index on exerciseId; on the astronomically
  // unlikely collision (~1 in 4B) Mongo throws E11000, the route returns a
  // 500, and a retry mints a fresh id. Not worth a retry loop at this scale.
  const exerciseId = `custom-${uuidv4().substring(0, 8)}`;
  const doc = await CustomExerciseModel.create({
    userId,
    exerciseId,
    name: input.name,
    categories: input.categories,
    photo: input.photo ?? null,
  });
  return toDefinition(doc);
}
