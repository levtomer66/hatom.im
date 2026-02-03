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

// Legacy workout type categories (kept for backwards compatibility and exercise filtering)
export type WorkoutType = 
  | 'pull' 
  | 'push' 
  | 'legs' 
  | 'calisthenics' 
  | 'full-body' 
  | 'upper-body' 
  | 'lower-body';

// Exercise filter categories for the picker
export const EXERCISE_FILTER_CATEGORIES: { id: WorkoutType; label: string; icon: string }[] = [
  { id: 'push', label: 'Push', icon: '💪' },
  { id: 'pull', label: 'Pull', icon: '🏋️' },
  { id: 'legs', label: 'Legs', icon: '🦵' },
  { id: 'calisthenics', label: 'Calisthenics', icon: '🤸' },
  { id: 'full-body', label: 'Full Body', icon: '🔥' },
  { id: 'upper-body', label: 'Upper Body', icon: '👆' },
  { id: 'lower-body', label: 'Lower Body', icon: '👇' },
];

// Legacy WORKOUT_TYPES kept for backwards compatibility
export const WORKOUT_TYPES = EXERCISE_FILTER_CATEGORIES;

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

// Single set with its own weight and reps
export interface WorkoutSet {
  kg: number | null;
  reps: number | null;
}

// Exercise entry in a workout
export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  order: number;  // Position in the workout (1st exercise = 1, 2nd = 2, etc.)
  sets: WorkoutSet[];  // Variable number of sets (2-5), each with their own kg/reps
  notes: string;
  photos: string[];
}

// Default number of sets for new exercises
export const DEFAULT_NUM_SETS = 3;
export const MIN_SETS = 2;
export const MAX_SETS = 5;

// Workout Template - reusable workout configuration
export interface WorkoutTemplate {
  _id?: string;
  id: string;
  userId: UserId;
  name: string;
  exerciseIds: string[];  // List of exercise IDs included in this template
  createdAt: string;
  updatedAt: string;
}

// Workout session (training instance)
export interface Workout {
  _id?: string;
  id: string;
  userId: UserId;
  templateId?: string;  // Optional reference to the template used
  workoutName: string;  // Name of the workout (from template or custom)
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
  // Completed PB info (if exercise was ever completed)
  completedKg: number | null;  // Highest weight where exercise was completed
  completedReps: number[];     // Reps at each set when completed (e.g., [10, 12, 10])
  completedDate: string | null;
  completedWorkoutId: string | null;
  // Current working weight (latest weight used, even if not completed)
  currentKg: number;           // Latest/highest weight being worked on
  currentReps: number[];       // Reps at current weight (e.g., [8, 6, 5] - not completed yet)
  currentDate: string;
  currentWorkoutId: string;
  // Recommendation
  recommendedKg: number;       // Suggested weight for next session
}

// Exercise history entry (for display)
export interface ExerciseHistoryEntry {
  date: string;
  order: number;  // Position in that workout
  sets: WorkoutSet[];
  workoutId: string;
  isPB: boolean;
  isCompleted: boolean;
}

// Helper to format reps display (e.g., "10×12×10")
export function formatRepsDisplay(reps: number[]): string {
  return reps.join('×');
}

// Helper to format PB display (e.g., "50kg: 10×12×10")
export function formatPBDisplay(kg: number, reps: number[]): string {
  return `${kg}kg: ${formatRepsDisplay(reps)}`;
}

// Helper function to check if exercise is completed
// Completed = ALL recorded sets at the highest weight have > 8 reps
export function isExerciseCompleted(exercise: WorkoutExercise): boolean {
  const validSets = exercise.sets.filter(s => s.kg !== null && s.kg > 0 && s.reps !== null);
  if (validSets.length === 0) return false;
  
  // Find the highest weight
  const highestKg = Math.max(...validSets.map(s => s.kg as number));
  
  // Get all sets at highest weight
  const setsAtHighestWeight = validSets.filter(s => s.kg === highestKg);
  
  // All sets at highest weight must have > 8 reps
  return setsAtHighestWeight.every(s => (s.reps as number) > 8);
}

// Helper function to calculate total reps across all sets
export function calculateTotalReps(exercise: WorkoutExercise): number {
  return exercise.sets.reduce((total, set) => total + (set.reps || 0), 0);
}

// Helper function to get the highest weight used in an exercise
export function getHighestWeight(exercise: WorkoutExercise): number {
  const validKgs = exercise.sets.filter(s => s.kg !== null && s.kg > 0).map(s => s.kg as number);
  return validKgs.length > 0 ? Math.max(...validKgs) : 0;
}

// Helper to create default sets for a new exercise
export function createDefaultSets(count: number = DEFAULT_NUM_SETS): WorkoutSet[] {
  return Array.from({ length: count }, () => ({ kg: null, reps: null }));
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
