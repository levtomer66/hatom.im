import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { UserId, PersonalBest, WorkoutSet, USER_IDS, isValidUserId } from '@/types/workout';
import { resolveExerciseId } from '@/data/exercise-library';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Check if exercise is completed (ALL sets at highest weight have > 8 reps)
function isCompleted(sets: WorkoutSet[]): boolean {
  const validSets = sets.filter(s => s.kg !== null && s.kg > 0 && s.reps !== null);
  if (validSets.length === 0) return false;
  
  const highestKg = Math.max(...validSets.map(s => s.kg as number));
  const setsAtHighestWeight = validSets.filter(s => s.kg === highestKg);
  
  // All sets at highest weight must have > 8 reps
  return setsAtHighestWeight.every(s => (s.reps as number) > 8);
}

// Highest weight across REP-MODE sets only. Time-mode sets have their own
// PB calculation downstream — letting their kg leak into this would make a
// weighted timed hold overwrite the exercise's rep-based current/working
// weight (Codex review flagged this).
function getHighestKg(sets: WorkoutSet[]): number {
  const validKgs = sets
    .filter(s => s.kg !== null && s.kg > 0 && s.reps !== null)
    .map(s => s.kg as number);
  return validKgs.length > 0 ? Math.max(...validKgs) : 0;
}

// Get reps at a specific weight (returns array of reps for each set at that weight)
function getRepsAtWeight(sets: WorkoutSet[], targetKg: number): number[] {
  return sets
    .filter(s => s.kg === targetKg && s.reps !== null)
    .map(s => s.reps as number);
}

interface PBMap {
  [exerciseId: string]: PersonalBest;
}

interface PBCandidate {
  // Best completed record
  completedKg: number | null;
  completedReps: number[];
  completedDate: string | null;
  completedWorkoutId: string | null;
  // Most recent/highest weight being worked on
  currentKg: number;
  currentReps: number[];
  currentDate: string;
  currentWorkoutId: string;
  // Time-mode PB tracked in parallel — same exercise can have both a rep
  // and a time PB (e.g. weighted plank). Bodyweight planks store kg=0.
  bestSeconds: number | null;
  bestSecondsKg: number | null;
  bestSecondsDate: string | null;
  bestSecondsWorkoutId: string | null;
}

// Pick the best time-mode (kg, seconds) tuple from a single workout's sets.
// Highest kg wins; ties broken by longest seconds.
function getBestTimeMode(sets: WorkoutSet[]): { kg: number; seconds: number } | null {
  let best: { kg: number; seconds: number } | null = null;
  for (const s of sets) {
    if (s.seconds === null || s.seconds <= 0) continue;
    const kg = s.kg ?? 0;
    if (
      best === null ||
      kg > best.kg ||
      (kg === best.kg && s.seconds > best.seconds)
    ) {
      best = { kg, seconds: s.seconds };
    }
  }
  return best;
}

// GET /api/workout/exercises/pb?userId=tom
// Returns all personal bests for a user, keyed by exerciseId
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') as UserId | null;
    
    if (!isValidUserId(userId)) {
      return NextResponse.json(
        { error: `Valid userId is required (${USER_IDS.join(', ')})` },
        { status: 400 }
      );
    }
    
    // Get workouts sorted by date (most recent first)
    const workouts = await WorkoutModel.find({ userId }).sort({ date: -1 }).lean();
    
    // Track PB candidates for each exercise
    const pbCandidates: Record<string, PBCandidate> = {};
    
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        const sets = exercise.sets || [];
        const highestKg = getHighestKg(sets);
        const timeBest = getBestTimeMode(sets);
        const exerciseId = resolveExerciseId(exercise.exerciseId);

        // Skip if neither a rep-mode nor time-mode signal exists.
        if (highestKg <= 0 && timeBest === null) continue;

        const repsAtHighest = highestKg > 0 ? getRepsAtWeight(sets, highestKg) : [];
        const completed = highestKg > 0 ? isCompleted(sets) : false;

        // Initialize candidate. Rep-mode fields stay at zero/empty until a
        // workout actually contributes rep data — otherwise a time-only
        // exercise (e.g. bodyweight plank) would emit a bogus
        // "Working: 0 kg ()" rep block on the detail page.
        if (!pbCandidates[exerciseId]) {
          pbCandidates[exerciseId] = {
            completedKg: null,
            completedReps: [],
            completedDate: null,
            completedWorkoutId: null,
            currentKg: 0,
            currentReps: [],
            currentDate: '',
            currentWorkoutId: '',
            bestSeconds: null,
            bestSecondsKg: null,
            bestSecondsDate: null,
            bestSecondsWorkoutId: null,
          };
        }

        const candidate = pbCandidates[exerciseId];

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

        // Rep-mode tracking only runs when this iteration has rep data
        // (highestKg already excludes time-mode sets). Otherwise we'd
        // overwrite the rep-current weight with a timed-hold's weight.
        if (highestKg > 0) {
          if (completed) {
            if (candidate.completedKg === null || highestKg > candidate.completedKg) {
              candidate.completedKg = highestKg;
              candidate.completedReps = repsAtHighest;
              candidate.completedDate = workout.date;
              candidate.completedWorkoutId = workout._id.toString();
            } else if (highestKg === candidate.completedKg) {
              // Same weight - prefer more total reps
              const currentTotal = candidate.completedReps.reduce((a, b) => a + b, 0);
              const newTotal = repsAtHighest.reduce((a, b) => a + b, 0);
              if (newTotal > currentTotal) {
                candidate.completedReps = repsAtHighest;
                candidate.completedDate = workout.date;
                candidate.completedWorkoutId = workout._id.toString();
              }
            }
          }

          // Track current working weight (highest weight used, most recent if tie).
          // Bootstraps off the empty sentinel on the first rep-data iteration.
          if (candidate.currentDate === '' || highestKg > candidate.currentKg) {
            candidate.currentKg = highestKg;
            candidate.currentReps = repsAtHighest;
            candidate.currentDate = workout.date;
            candidate.currentWorkoutId = workout._id.toString();
          } else if (highestKg === candidate.currentKg) {
            // Same weight - prefer more recent date
            if (new Date(workout.date) > new Date(candidate.currentDate)) {
              candidate.currentReps = repsAtHighest;
              candidate.currentDate = workout.date;
              candidate.currentWorkoutId = workout._id.toString();
            }
          }
        }
      }
    }
    
    // Build final PB map
    const pbMap: PBMap = {};
    for (const [exerciseId, candidate] of Object.entries(pbCandidates)) {
      // Calculate recommended weight
      let recommendedKg = candidate.currentKg;
      if (candidate.completedKg !== null) {
        // If completed at this weight, recommend +2.5kg
        if (candidate.completedKg >= candidate.currentKg) {
          recommendedKg = candidate.completedKg + 2.5;
        }
      }
      
      const pb: PersonalBest = {
        userId,
        exerciseId,
        completedKg: candidate.completedKg,
        completedReps: candidate.completedReps,
        completedDate: candidate.completedDate,
        completedWorkoutId: candidate.completedWorkoutId,
        currentKg: candidate.currentKg,
        currentReps: candidate.currentReps,
        currentDate: candidate.currentDate,
        currentWorkoutId: candidate.currentWorkoutId,
        recommendedKg,
        bestSeconds: candidate.bestSeconds,
        bestSecondsKg: candidate.bestSecondsKg,
        bestSecondsDate: candidate.bestSecondsDate,
        bestSecondsWorkoutId: candidate.bestSecondsWorkoutId,
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
