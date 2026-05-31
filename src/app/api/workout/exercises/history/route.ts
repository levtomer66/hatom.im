import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import {
  ExerciseHistoryEntry,
  WorkoutSet,
  isTimeSet,
  bestE1rmFromSets,
} from '@/types/workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { resolveExerciseId } from '@/data/exercise-library';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// "Completed" on a history entry = the user finished logging every set
// for the exercise. Used for the green-border styling, not for PB
// gating (PB is e1RM-based now). Rep-mode sets need kg+reps; time-mode
// sets need seconds > 0.
function isAllSetsLogged(sets: WorkoutSet[]): boolean {
  if (sets.length === 0) return false;
  return sets.every((s) => {
    if (isTimeSet(s)) return (s.seconds as number) > 0;
    return s.kg !== null && s.kg > 0 && s.reps !== null && s.reps > 0;
  });
}

// Workout-level peak e1RM for an exercise's sets. Used both to mark
// the PB entry in the history list and to surface the chart's data.
function workoutBestE1rm(sets: WorkoutSet[]): number {
  return bestE1rmFromSets(sets)?.e1rm ?? 0;
}

// GET /api/workout/exercises/history?exerciseId=bench-press
// userId derived from the Auth.js session.
export async function GET(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const exerciseId = searchParams.get('exerciseId');

    const matchCondition: Record<string, unknown> = { userId };

    const workouts = await WorkoutModel.find(matchCondition)
      .sort({ date: -1 })
      .lean();

    const historyEntries: ExerciseHistoryEntry[] = [];

    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        const resolvedId = resolveExerciseId(exercise.exerciseId);
        if (exerciseId && resolvedId !== exerciseId) continue;

        const sets = exercise.sets || [];
        const hasData = sets.some(
          (s) => s.kg !== null || s.reps !== null || isTimeSet(s),
        );

        if (hasData) {
          historyEntries.push({
            date: workout.date,
            order: exercise.order || 0,
            workoutName: workout.workoutName || '',
            sets,
            workoutId: workout._id.toString(),
            isPB: false, // filled in below
            isCompleted: isAllSetsLogged(sets),
            replacedFromExerciseId: exercise.replacedFromExerciseId ?? null,
          });
        }
      }
    }

    // PB = the single entry with the highest e1RM. Ties resolve to the
    // earliest occurrence (the workout where the user FIRST hit it) —
    // celebrates the original achievement over repeats. This matches
    // how the PB endpoint picks bestKg/bestReps.
    let pbE1rm = 0;
    let pbIndex = -1;
    for (let i = 0; i < historyEntries.length; i++) {
      const e = workoutBestE1rm(historyEntries[i].sets);
      if (e <= 0) continue;
      if (e > pbE1rm) {
        pbE1rm = e;
        pbIndex = i;
      } else if (e === pbE1rm && pbIndex >= 0) {
        // Same e1RM — prefer the earlier occurrence (first time the user
        // hit it). Compare by date, and break a same-DAY tie by the
        // workoutId. Mongo ObjectIds are monotonic with creation time,
        // so the lexicographically-smaller id is the earlier-created
        // workout — this makes the PB pick deterministic instead of
        // depending on cursor order for same-day ties (Codex P1).
        const candDate = new Date(historyEntries[i].date).getTime();
        const curDate = new Date(historyEntries[pbIndex].date).getTime();
        if (
          candDate < curDate ||
          (candDate === curDate && historyEntries[i].workoutId < historyEntries[pbIndex].workoutId)
        ) {
          pbIndex = i;
        }
      }
    }
    if (pbIndex >= 0) historyEntries[pbIndex].isPB = true;

    // Outer loop already walks desc by date, so historyEntries is
    // already newest-first. No re-sort needed.

    return NextResponse.json(historyEntries);
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exercise history' },
      { status: 500 }
    );
  }
}
