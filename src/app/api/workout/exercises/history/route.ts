import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { UserId, ExerciseHistoryEntry } from '@/types/workout';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// Check if an entry is completed (all 3 sets have 10+ reps)
function isCompleted(entry: ExerciseHistoryEntry): boolean {
  return (
    entry.set1Reps !== null &&
    entry.set1Reps >= 10 &&
    entry.set2Reps !== null &&
    entry.set2Reps >= 10 &&
    entry.set3Reps !== null &&
    entry.set3Reps >= 10
  );
}

// GET /api/workout/exercises/history?userId=tom&exerciseId=bench-press
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') as UserId | null;
    const exerciseId = searchParams.get('exerciseId');
    
    if (!userId || !['tom', 'tomer'].includes(userId)) {
      return NextResponse.json(
        { error: 'Valid userId is required (tom or tomer)' },
        { status: 400 }
      );
    }
    
    // Build query - if exerciseId provided, filter for that exercise
    const matchCondition: Record<string, unknown> = { userId };
    
    const workouts = await WorkoutModel.find(matchCondition)
      .sort({ date: -1 })
      .lean();
    
    // Extract exercise history entries
    const historyEntries: ExerciseHistoryEntry[] = [];
    
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        // Filter by exerciseId if provided
        if (exerciseId && exercise.exerciseId !== exerciseId) {
          continue;
        }
        
        // Only include entries that have some data
        if (exercise.scaleKg !== null || exercise.set1Reps !== null) {
          historyEntries.push({
            date: workout.date,
            scaleKg: exercise.scaleKg || 0,
            set1Reps: exercise.set1Reps,
            set2Reps: exercise.set2Reps,
            set3Reps: exercise.set3Reps,
            workoutId: workout._id.toString(),
            isPB: false, // Will be calculated below
          });
        }
      }
    }
    
    // Sort entries for PB determination
    const sortByPBCriteria = (a: ExerciseHistoryEntry, b: ExerciseHistoryEntry) => {
      if (b.scaleKg !== a.scaleKg) return b.scaleKg - a.scaleKg;
      
      const aTotalReps = (a.set1Reps || 0) + (a.set2Reps || 0) + (a.set3Reps || 0);
      const bTotalReps = (b.set1Reps || 0) + (b.set2Reps || 0) + (b.set3Reps || 0);
      if (bTotalReps !== aTotalReps) return bTotalReps - aTotalReps;
      
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    };
    
    // Find PB: prefer highest completed, fall back to highest overall
    const completedEntries = historyEntries.filter(e => isCompleted(e) && e.scaleKg > 0);
    const allEntriesWithWeight = historyEntries.filter(e => e.scaleKg > 0);
    
    let pbEntry: ExerciseHistoryEntry | null = null;
    
    if (completedEntries.length > 0) {
      // Sort completed entries and take the best
      completedEntries.sort(sortByPBCriteria);
      pbEntry = completedEntries[0];
    } else if (allEntriesWithWeight.length > 0) {
      // No completions, use highest weight
      allEntriesWithWeight.sort(sortByPBCriteria);
      pbEntry = allEntriesWithWeight[0];
    }
    
    // Mark the PB entry
    if (pbEntry) {
      const pbIndex = historyEntries.findIndex(
        e => e.date === pbEntry!.date && 
             e.scaleKg === pbEntry!.scaleKg && 
             e.workoutId === pbEntry!.workoutId
      );
      if (pbIndex >= 0) {
        historyEntries[pbIndex].isPB = true;
      }
    }
    
    // Sort final results by date (most recent first) then by weight
    historyEntries.sort((a, b) => {
      if (b.scaleKg !== a.scaleKg) return b.scaleKg - a.scaleKg;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    
    return NextResponse.json(historyEntries);
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exercise history' },
      { status: 500 }
    );
  }
}
