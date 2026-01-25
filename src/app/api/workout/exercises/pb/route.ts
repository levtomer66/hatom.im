import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { UserId, PersonalBest } from '@/types/workout';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Check if exercise is completed (all 3 sets have 10+ reps)
function isCompleted(exercise: { set1Reps: number | null; set2Reps: number | null; set3Reps: number | null }): boolean {
  return (
    exercise.set1Reps !== null &&
    exercise.set1Reps >= 10 &&
    exercise.set2Reps !== null &&
    exercise.set2Reps >= 10 &&
    exercise.set3Reps !== null &&
    exercise.set3Reps >= 10
  );
}

interface PBMap {
  [exerciseId: string]: PersonalBest;
}

interface PBCandidate {
  completed: PersonalBest | null;
  highest: PersonalBest | null;
  lastCompleted: { scaleKg: number; date: string } | null; // Most recent completed
}

// GET /api/workout/exercises/pb?userId=tom
// Returns all personal bests for a user, keyed by exerciseId
// PB = highest completed weight, or if no completions, highest weight used
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
    
    const workouts = await WorkoutModel.find({ userId }).lean();
    
    // Track both completed PBs and highest weight PBs separately
    const pbCandidates: Record<string, PBCandidate> = {};
    
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        // Skip if no weight set
        if (exercise.scaleKg === null || exercise.scaleKg <= 0) continue;
        
        const totalReps = (exercise.set1Reps || 0) + (exercise.set2Reps || 0) + (exercise.set3Reps || 0);
        const completed = isCompleted(exercise);
        
        // Initialize candidate tracking for this exercise
        if (!pbCandidates[exercise.exerciseId]) {
          pbCandidates[exercise.exerciseId] = { completed: null, highest: null, lastCompleted: null };
        }
        
        const candidate = pbCandidates[exercise.exerciseId];
        const pbEntry: PersonalBest = {
          userId,
          exerciseId: exercise.exerciseId,
          scaleKg: exercise.scaleKg,
          totalReps,
          date: workout.date,
          workoutId: workout._id.toString(),
        };
        
        // Track highest completed
        if (completed) {
          if (!candidate.completed) {
            candidate.completed = pbEntry;
          } else if (exercise.scaleKg > candidate.completed.scaleKg) {
            candidate.completed = pbEntry;
          } else if (exercise.scaleKg === candidate.completed.scaleKg) {
            if (totalReps > candidate.completed.totalReps) {
              candidate.completed = pbEntry;
            } else if (totalReps === candidate.completed.totalReps) {
              if (new Date(workout.date) > new Date(candidate.completed.date)) {
                candidate.completed = pbEntry;
              }
            }
          }
          
          // Track most recent completed (for recommended scale)
          if (!candidate.lastCompleted || new Date(workout.date) > new Date(candidate.lastCompleted.date)) {
            candidate.lastCompleted = { scaleKg: exercise.scaleKg, date: workout.date };
          }
        }
        
        // Track highest overall (regardless of completion)
        if (!candidate.highest) {
          candidate.highest = pbEntry;
        } else if (exercise.scaleKg > candidate.highest.scaleKg) {
          candidate.highest = pbEntry;
        } else if (exercise.scaleKg === candidate.highest.scaleKg) {
          if (totalReps > candidate.highest.totalReps) {
            candidate.highest = pbEntry;
          } else if (totalReps === candidate.highest.totalReps) {
            if (new Date(workout.date) > new Date(candidate.highest.date)) {
              candidate.highest = pbEntry;
            }
          }
        }
      }
    }
    
    // Build final PB map: prefer completed, fall back to highest
    // Also include lastCompletedKg for recommended scale
    const pbMap: PBMap = {};
    for (const [exerciseId, candidate] of Object.entries(pbCandidates)) {
      const pb = candidate.completed || candidate.highest!;
      if (candidate.lastCompleted) {
        pb.lastCompletedKg = candidate.lastCompleted.scaleKg;
      }
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
