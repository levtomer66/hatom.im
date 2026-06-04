import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { getStoredPersonalBests } from '@/lib/workout-pb';
import { getOwnTemplates, getSharedTemplates, getTemplateUsage } from '@/lib/workout-templates';
import { listCustomExercises } from '@/lib/workout-custom-exercises';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Most-recent in-progress workout for the user, full document (or null).
// Mirrors the auto-resume the page used to do via list→find→fetch-by-id, but
// in a single indexed query (the userId+date index already exists).
async function getInProgressWorkout(userId: string) {
  await connectDB();
  const w = await WorkoutModel.findOne({ userId, isCompleted: false })
    .sort({ date: -1, createdAt: -1 })
    .lean();
  if (!w) return null;
  return { ...w, id: w._id.toString(), _id: undefined };
}

// GET /api/workout/bootstrap
// Everything the /workout page needs on cold load, in ONE call: personal
// bests (cached), the caller's own templates, owner-shared templates, the
// owner usage map, and the most-recent in-progress workout (full). Replaces
// the old pb + templates×(2–3) + workouts(list→full) fan-out — fewer round
// trips on the slow shared Atlas tier, and no sequential resume waterfall.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    // Connect once up front so the parallel helpers below all see a live
    // connection (their own connectDB() then no-ops) — avoids a connect race.
    await connectDB();

    const [personalBests, templates, sharedTemplates, templateUsage, activeWorkout, customExercises] =
      await Promise.all([
        getStoredPersonalBests(userId),
        getOwnTemplates(userId),
        getSharedTemplates(),
        getTemplateUsage(userId),
        getInProgressWorkout(userId),
        listCustomExercises(userId),
      ]);

    return NextResponse.json({
      personalBests,
      templates,
      sharedTemplates,
      templateUsage,
      activeWorkout,
      customExercises,
    });
  } catch (error) {
    console.error('Error building workout bootstrap:', error);
    return NextResponse.json({ error: 'Failed to load workout bootstrap' }, { status: 500 });
  }
}
