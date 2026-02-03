import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { UserId, ExerciseHistoryEntry, WorkoutSet } from '@/types/workout';

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

// Get total reps at highest weight
function getTotalRepsAtHighest(sets: WorkoutSet[]): number {
  const highestKg = getHighestKg(sets);
  if (highestKg === 0) return 0;
  return sets
    .filter(s => s.kg === highestKg)
    .reduce((sum, s) => sum + (s.reps || 0), 0);
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
        
        const sets = exercise.sets || [];
        const hasData = sets.some(s => s.kg !== null || s.reps !== null);
        
        // Only include entries that have some data
        if (hasData) {
          historyEntries.push({
            date: workout.date,
            order: exercise.order || 0,  // Include exercise order in workout
            sets,
            workoutId: workout._id.toString(),
            isPB: false, // Will be calculated below
            isCompleted: isCompleted(sets),
          });
        }
      }
    }
    
    // Sort entries for PB determination
    const sortByPBCriteria = (a: ExerciseHistoryEntry, b: ExerciseHistoryEntry) => {
      const aHighestKg = getHighestKg(a.sets);
      const bHighestKg = getHighestKg(b.sets);
      if (bHighestKg !== aHighestKg) return bHighestKg - aHighestKg;
      
      const aTotalReps = getTotalRepsAtHighest(a.sets);
      const bTotalReps = getTotalRepsAtHighest(b.sets);
      if (bTotalReps !== aTotalReps) return bTotalReps - aTotalReps;
      
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    };
    
    // Find PB: prefer highest completed, fall back to highest overall
    const completedEntries = historyEntries.filter(e => e.isCompleted && getHighestKg(e.sets) > 0);
    const allEntriesWithWeight = historyEntries.filter(e => getHighestKg(e.sets) > 0);
    
    let pbEntry: ExerciseHistoryEntry | null = null;
    
    if (completedEntries.length > 0) {
      completedEntries.sort(sortByPBCriteria);
      pbEntry = completedEntries[0];
    } else if (allEntriesWithWeight.length > 0) {
      allEntriesWithWeight.sort(sortByPBCriteria);
      pbEntry = allEntriesWithWeight[0];
    }
    
    // Mark the PB entry
    if (pbEntry) {
      const pbIndex = historyEntries.findIndex(
        e => e.date === pbEntry!.date && e.workoutId === pbEntry!.workoutId
      );
      if (pbIndex >= 0) {
        historyEntries[pbIndex].isPB = true;
      }
    }
    
    // Sort final results by highest weight then by date
    historyEntries.sort((a, b) => {
      const aHighestKg = getHighestKg(a.sets);
      const bHighestKg = getHighestKg(b.sets);
      if (bHighestKg !== aHighestKg) return bHighestKg - aHighestKg;
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
