// Display unit for weights. Storage is always kg — this is a per-device
// display preference. Input values typed in lb are converted to kg before
// they hit Mongo, and kg values from the DB are converted to lb for
// display when the user has selected lb. PBs, history, and
// recommendations all stay in kg internally so cross-user comparisons
// remain consistent.
export type WeightUnit = 'kg' | 'lb';
export const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];
export function isWeightUnit(v: unknown): v is WeightUnit {
  return v === 'kg' || v === 'lb';
}

// Language selection
export type Language = 'en' | 'he';

export const LANGUAGES: readonly Language[] = ['en', 'he'];

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'he';
}

// User types
export type UserId = 'tom' | 'tomer' | 'amit';

export interface User {
  id: UserId;
  name: string;
}

export const USERS: User[] = [
  { id: 'tom', name: 'Tom' },
  { id: 'tomer', name: 'Tomer' },
  { id: 'amit', name: 'Amit' },
];

// Canonical list of valid user IDs — use this everywhere that needs to validate
// an incoming `userId` or seed a Mongoose enum, so adding a new user is one edit.
export const USER_IDS: readonly UserId[] = USERS.map(u => u.id);

export function isValidUserId(value: unknown): value is UserId {
  return typeof value === 'string' && (USER_IDS as readonly string[]).includes(value);
}

// Legacy workout type categories (kept for backwards compatibility and exercise filtering)
export type WorkoutType = 
  | 'pull' 
  | 'push' 
  | 'legs' 
  | 'calisthenics' 
  | 'full-body' 
  | 'upper-body' 
  | 'lower-body'
  // Muscle groups
  | 'chest'
  | 'triceps'
  | 'shoulders'
  | 'back'
  | 'biceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

// Exercise filter categories for the picker
export const EXERCISE_FILTER_CATEGORIES: { id: WorkoutType; label: string; icon: string }[] = [
  { id: 'push', label: 'Push', icon: '💪' },
  { id: 'pull', label: 'Pull', icon: '🏋️' },
  { id: 'legs', label: 'Legs', icon: '🦵' },
  { id: 'calisthenics', label: 'Calisthenics', icon: '🤸' },
  { id: 'full-body', label: 'Full Body', icon: '🔥' },
  // Muscle groups
  { id: 'chest', label: 'Chest', icon: '🫁' },
  { id: 'back', label: 'Back', icon: '🔙' },
  { id: 'shoulders', label: 'Shoulders', icon: '🎯' },
  { id: 'biceps', label: 'Biceps', icon: '💪' },
  { id: 'triceps', label: 'Triceps', icon: '🦾' },
  { id: 'quads', label: 'Quads', icon: '🦵' },
  { id: 'hamstrings', label: 'Hamstrings', icon: '🦿' },
  { id: 'glutes', label: 'Glutes', icon: '🍑' },
  { id: 'calves', label: 'Calves', icon: '🦶' },
  { id: 'abs', label: 'Abs', icon: '🎽' },
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
  | 'full-body'
  // Muscle groups
  | 'chest'
  | 'triceps'
  | 'shoulders'
  | 'back'
  | 'biceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

// Exercise library definition.
// `name` and `description` are the canonical English values. Translations for
// other languages live in `src/lib/exercise-translations/<lang>.ts` — one file
// per language, keyed by exercise `id`. Adding a new language is one new file
// plus one line in `src/lib/exercise-translations/index.ts`.
export interface ExerciseDefinition {
  id: string;
  name: string;
  description?: string;
  categories: ExerciseCategory[];
  defaultPhoto?: string;
  isCustom?: boolean;
}

// Single set with its own weight, reps, and optional time-mode duration.
// `seconds !== null` flips this set into time-mode (planks, hangs,
// isometric holds). The two are mutually exclusive in practice — toggling
// the row clears the inactive field — but both are nullable so existing
// data round-trips.
export interface WorkoutSet {
  kg: number | null;
  reps: number | null;
  seconds: number | null;
}

// `set.seconds !== null` means it's a time-mode set. Avoids repeating
// this check across the codebase.
export function isTimeSet(s: WorkoutSet): boolean {
  return s.seconds !== null;
}

// Exercise entry in a workout
export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  order: number;  // Position in the workout (1st exercise = 1, 2nd = 2, etc.)
  sets: WorkoutSet[];  // Variable number of sets (2-5), each with their own kg/reps
  notes: string;
  photos: string[];
  // When the user swaps an exercise mid-workout via the replace flow, we
  // keep the original exerciseId here so history views can surface a
  // "was: Bench Press" annotation. Not set for fresh or template-started
  // exercises.
  replacedFromExerciseId?: string | null;
}

// Default number of sets for new exercises
export const DEFAULT_NUM_SETS = 3;
export const MIN_SETS = 1;
export const MAX_SETS = 5;

// One entry in a workout template — carries default set count + notes
// that will be applied when a workout is started from this template.
export interface TemplateExercise {
  exerciseId: string;
  numSets: number;   // default number of sets (MIN_SETS..MAX_SETS)
  notes: string;     // default notes for this exercise in this template
}

// Workout Template - reusable workout configuration
export interface WorkoutTemplate {
  _id?: string;
  id: string;
  userId: UserId;
  name: string;
  exercises: TemplateExercise[];  // Ordered list of exercise entries (with per-exercise defaults)
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
  // Time-mode PB tracked in parallel — same exercise can have both a
  // rep-based and a time-based PB (e.g. weighted plank).
  bestSeconds: number | null;
  bestSecondsKg: number | null;
  bestSecondsDate: string | null;
  bestSecondsWorkoutId: string | null;
}

// Exercise history entry (for display)
export interface ExerciseHistoryEntry {
  date: string;
  order: number;         // Position in that workout
  workoutName: string;   // Name of the workout (template) this exercise was part of
  sets: WorkoutSet[];
  workoutId: string;
  isPB: boolean;
  isCompleted: boolean;
  replacedFromExerciseId?: string | null;  // If set, this slot was swapped in during the workout — history UIs surface "was: X"
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
  return Array.from({ length: count }, () => ({ kg: null, reps: null, seconds: null }));
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
