import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { UserId, PersonalBest, WorkoutSet } from '@/types/workout';

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

// Get highest weight from sets
function getHighestKg(sets: WorkoutSet[]): number {
  const validKgs = sets.filter(s => s.kg !== null && s.kg > 0).map(s => s.kg as number);
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
}

// GET /api/workout/exercises/pb?userId=tom
// Returns all personal bests for a user, keyed by exerciseId
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
    
    // Get workouts sorted by date (most recent first)
    const workouts = await WorkoutModel.find({ userId }).sort({ date: -1 }).lean();
    
    // Track PB candidates for each exercise
    const pbCandidates: Record<string, PBCandidate> = {};
    
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        const sets = exercise.sets || [];
        const highestKg = getHighestKg(sets);
        
        // Skip if no valid weight
        if (highestKg <= 0) continue;
        
        const repsAtHighest = getRepsAtWeight(sets, highestKg);
        const completed = isCompleted(sets);
        
        // Initialize candidate tracking for this exercise
        if (!pbCandidates[exercise.exerciseId]) {
          pbCandidates[exercise.exerciseId] = {
            completedKg: null,
            completedReps: [],
            completedDate: null,
            completedWorkoutId: null,
            currentKg: highestKg,
            currentReps: repsAtHighest,
            currentDate: workout.date,
            currentWorkoutId: workout._id.toString(),
          };
        }
        
        const candidate = pbCandidates[exercise.exerciseId];
        
        // Track highest completed weight
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
        
        // Track current working weight (highest weight used, most recent if tie)
        if (highestKg > candidate.currentKg) {
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
