// User types
export type UserId = 'tom' | 'tomer';

export interface User {
  id: UserId;
  name: string;
}

export const USERS: User[] = [
  { id: 'tom', name: 'Tom' },
  { id: 'tomer', name: 'Tomer' },
];

// Workout type categories
export type WorkoutType = 
  | 'pull' 
  | 'push' 
  | 'legs' 
  | 'calisthenics' 
  | 'full-body' 
  | 'upper-body' 
  | 'lower-body';

export const WORKOUT_TYPES: { id: WorkoutType; label: string; icon: string }[] = [
  { id: 'pull', label: 'Pull', icon: '🏋️' },
  { id: 'push', label: 'Push', icon: '💪' },
  { id: 'legs', label: 'Legs', icon: '🦵' },
  { id: 'calisthenics', label: 'Calisthenics', icon: '🤸' },
  { id: 'full-body', label: 'Full Body', icon: '🔥' },
  { id: 'upper-body', label: 'Upper Body', icon: '👆' },
  { id: 'lower-body', label: 'Lower Body', icon: '👇' },
];

// Exercise category tags
export type ExerciseCategory = 
  | 'pull' 
  | 'push' 
  | 'legs' 
  | 'calisthenics' 
  | 'upper-body' 
  | 'lower-body' 
  | 'full-body';

// Exercise library definition
export interface ExerciseDefinition {
  id: string;
  name: string;
  categories: ExerciseCategory[];
  defaultPhoto?: string;
  isCustom?: boolean;
}

// Exercise entry in a workout
export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  scaleKg: number | null;
  set1Reps: number | null;
  set2Reps: number | null;
  set3Reps: number | null;
  notes: string;
  photos: string[];
}

// Workout session
export interface Workout {
  _id?: string;
  id: string;
  userId: UserId;
  workoutType: WorkoutType;
  date: string; // ISO date string
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
}

// Personal Best record
export interface PersonalBest {
  userId: UserId;
  exerciseId: string;
  scaleKg: number;
  totalReps: number;
  date: string;
  workoutId: string;
  lastCompletedKg?: number; // Most recent completed weight (for recommended scale)
}

// Exercise history entry (for display)
export interface ExerciseHistoryEntry {
  date: string;
  scaleKg: number;
  set1Reps: number | null;
  set2Reps: number | null;
  set3Reps: number | null;
  workoutId: string;
  isPB: boolean;
}

// Helper function to check if exercise is completed (all 3 sets have 10+ reps at a weight)
export function isExerciseCompleted(exercise: WorkoutExercise): boolean {
  return (
    exercise.scaleKg !== null &&
    exercise.scaleKg > 0 &&
    exercise.set1Reps !== null &&
    exercise.set1Reps >= 10 &&
    exercise.set2Reps !== null &&
    exercise.set2Reps >= 10 &&
    exercise.set3Reps !== null &&
    exercise.set3Reps >= 10
  );
}

// Helper function to calculate total reps
export function calculateTotalReps(exercise: WorkoutExercise): number {
  return (exercise.set1Reps || 0) + (exercise.set2Reps || 0) + (exercise.set3Reps || 0);
}

// Workout type to exercise categories mapping for filtering
// Returns PRIMARY categories that must be matched - exercise must have at least one of these
export function getFilterCategoriesForWorkoutType(workoutType: WorkoutType): ExerciseCategory[] {
  switch (workoutType) {
    case 'pull':
      // Only exercises tagged as 'pull' (back, biceps, rear delts)
      return ['pull'];
    case 'push':
      // Only exercises tagged as 'push' (chest, shoulders, triceps)
      return ['push'];
    case 'legs':
      // Only exercises tagged as 'legs'
      return ['legs'];
    case 'calisthenics':
      // Only calisthenics exercises
      return ['calisthenics'];
    case 'upper-body':
      // Both pull and push exercises
      return ['pull', 'push', 'upper-body'];
    case 'lower-body':
      // Legs exercises
      return ['legs', 'lower-body'];
    case 'full-body':
      // All exercises
      return ['full-body', 'pull', 'push', 'legs', 'upper-body', 'lower-body', 'calisthenics'];
    default:
      return [];
  }
}
