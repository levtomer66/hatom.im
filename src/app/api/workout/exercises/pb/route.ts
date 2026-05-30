import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import {
  PersonalBest,
  WorkoutSet,
  isTimeSet,
  bestE1rmFromSets,
  BestE1rm,
} from '@/types/workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { resolveExerciseId } from '@/data/exercise-library';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Highest weight across REP-MODE sets only. Time-mode sets have their
// own PB lane downstream — letting their kg leak into this would make
// a weighted timed hold overwrite the exercise's rep-based current
// weight (Codex review flagged this).
function getHighestKg(sets: WorkoutSet[]): number {
  let max = 0;
  for (const s of sets) {
    if (isTimeSet(s)) continue;
    if (s.kg !== null && s.kg > 0 && s.reps !== null && s.kg > max) max = s.kg;
  }
  return max;
}

// Reps at a specific weight across rep-mode sets only.
function getRepsAtWeight(sets: WorkoutSet[], targetKg: number): number[] {
  return sets
    .filter((s) => !isTimeSet(s) && s.kg === targetKg && s.reps !== null)
    .map((s) => s.reps as number);
}

interface PBMap {
  [exerciseId: string]: PersonalBest;
}

// Per-exercise running PB candidate. `best*` tracks the rep-mode peak
// (Epley e1RM with rep cap at 10); `current*` tracks the most recent
// rep-mode occurrence (drives prefill + recommendation); time-mode is
// in a parallel lane.
interface PBCandidate {
  bestE1rm: number | null;
  bestKg: number | null;
  bestReps: number | null;
  bestDate: string | null;
  bestWorkoutId: string | null;

  currentKg: number;
  currentReps: number[];
  currentDate: string;
  currentWorkoutId: string;

  bestSeconds: number | null;
  bestSecondsKg: number | null;
  bestSecondsDate: string | null;
  bestSecondsWorkoutId: string | null;

  lastSets: WorkoutSet[] | null;
  lastSetsDate: string;
}

// Pick the best time-mode (kg, seconds) tuple from a single workout's sets.
// Highest kg wins; ties broken by longest seconds.
function getBestTimeMode(sets: WorkoutSet[]): { kg: number; seconds: number } | null {
  let best: { kg: number; seconds: number } | null = null;
  for (const s of sets) {
    if (!isTimeSet(s) || (s.seconds ?? 0) <= 0) continue;
    const seconds = s.seconds as number;
    const kg = s.kg ?? 0;
    if (
      best === null ||
      kg > best.kg ||
      (kg === best.kg && seconds > best.seconds)
    ) {
      best = { kg, seconds };
    }
  }
  return best;
}

// GET /api/workout/exercises/pb
// Returns all personal bests for the signed-in user, keyed by exerciseId.
// PB is computed via Epley e1RM (rep cap 10) so 100 × 5 (strength) and
// 80 × 10 (hypertrophy) are comparable on a unified scale.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    await connectDB();

    // Workouts most-recent first so `last*` and `current*` fields stay
    // correct on first encounter.
    const workouts = await WorkoutModel.find({ userId }).sort({ date: -1 }).lean();

    const pbCandidates: Record<string, PBCandidate> = {};

    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        const sets = exercise.sets || [];
        const highestKg = getHighestKg(sets);
        const timeBest = getBestTimeMode(sets);
        const setBest: BestE1rm | null = bestE1rmFromSets(sets);
        const exerciseId = resolveExerciseId(exercise.exerciseId);

        // Skip when this workout's exercise has neither rep-mode nor
        // time-mode data — purely empty entries shouldn't pollute PB.
        if (highestKg <= 0 && timeBest === null) continue;

        if (!pbCandidates[exerciseId]) {
          pbCandidates[exerciseId] = {
            bestE1rm: null,
            bestKg: null,
            bestReps: null,
            bestDate: null,
            bestWorkoutId: null,
            currentKg: 0,
            currentReps: [],
            currentDate: '',
            currentWorkoutId: '',
            bestSeconds: null,
            bestSecondsKg: null,
            bestSecondsDate: null,
            bestSecondsWorkoutId: null,
            lastSets: null,
            lastSetsDate: '',
          };
        }

        const candidate = pbCandidates[exerciseId];

        // Capture the most recent sets verbatim (drives kg-prefill).
        if (
          candidate.lastSets === null ||
          new Date(workout.date) > new Date(candidate.lastSetsDate)
        ) {
          candidate.lastSets = sets.map((s) => ({
            kg: s.kg ?? null,
            reps: s.reps ?? null,
            seconds: s.seconds ?? null,
          }));
          candidate.lastSetsDate = workout.date;
        }

        // Time-mode PB: highest kg wins, ties broken by longest seconds.
        if (timeBest !== null) {
          const isBetter =
            candidate.bestSecondsKg === null ||
            timeBest.kg > candidate.bestSecondsKg ||
            (timeBest.kg === candidate.bestSecondsKg &&
              candidate.bestSeconds !== null &&
              timeBest.seconds > candidate.bestSeconds);
          if (isBetter) {
            candidate.bestSeconds = timeBest.seconds;
            candidate.bestSecondsKg = timeBest.kg;
            candidate.bestSecondsDate = workout.date;
            candidate.bestSecondsWorkoutId = workout._id.toString();
          }
        }

        // Rep-mode tracking — only runs when this workout has rep
        // data, so a time-only iteration can't stomp on currentKg.
        if (highestKg > 0) {
          // PB candidate: did this workout produce a better e1RM than
          // anything previously seen? Ties resolve to the more recent
          // occurrence — outer loop is desc, so an existing best is
          // already the most recent for the same value.
          if (
            setBest !== null &&
            (candidate.bestE1rm === null || setBest.e1rm > candidate.bestE1rm)
          ) {
            candidate.bestE1rm = setBest.e1rm;
            candidate.bestKg = setBest.kg;
            candidate.bestReps = setBest.reps;
            candidate.bestDate = workout.date;
            candidate.bestWorkoutId = workout._id.toString();
          }

          // Current working weight = highest kg used most recently.
          if (candidate.currentDate === '' || highestKg > candidate.currentKg) {
            const repsAtHighest = getRepsAtWeight(sets, highestKg);
            candidate.currentKg = highestKg;
            candidate.currentReps = repsAtHighest;
            candidate.currentDate = workout.date;
            candidate.currentWorkoutId = workout._id.toString();
          } else if (highestKg === candidate.currentKg) {
            if (new Date(workout.date) > new Date(candidate.currentDate)) {
              candidate.currentReps = getRepsAtWeight(sets, highestKg);
              candidate.currentDate = workout.date;
              candidate.currentWorkoutId = workout._id.toString();
            }
          }
        }
      }
    }

    // Build the final PB map.
    const pbMap: PBMap = {};
    for (const [exerciseId, candidate] of Object.entries(pbCandidates)) {
      // Recommendation: if the user has just hit their PB at the
      // current working weight (current weight >= the PB-producing
      // weight), nudge them up by 2.5 kg next session at the same
      // rep target. Otherwise stick to the current working weight —
      // they likely have room before the next PB.
      let recommendedKg = candidate.currentKg;
      if (
        candidate.bestKg !== null &&
        candidate.currentKg >= candidate.bestKg
      ) {
        recommendedKg = candidate.bestKg + 2.5;
      }

      const pb: PersonalBest = {
        userId,
        exerciseId,
        bestE1rm: candidate.bestE1rm,
        bestKg: candidate.bestKg,
        bestReps: candidate.bestReps,
        bestDate: candidate.bestDate,
        bestWorkoutId: candidate.bestWorkoutId,
        currentKg: candidate.currentKg,
        currentReps: candidate.currentReps,
        currentDate: candidate.currentDate,
        currentWorkoutId: candidate.currentWorkoutId,
        recommendedKg,
        bestSeconds: candidate.bestSeconds,
        bestSecondsKg: candidate.bestSecondsKg,
        bestSecondsDate: candidate.bestSecondsDate,
        bestSecondsWorkoutId: candidate.bestSecondsWorkoutId,
        lastSets: candidate.lastSets ?? undefined,
      };
      pbMap[exerciseId] = pb;
    }

    return NextResponse.json(pbMap);
  } catch (error) {
    console.error('Error fetching personal bests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personal bests' },
      { status: 500 }
    );
  }
}
