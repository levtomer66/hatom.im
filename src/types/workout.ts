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

// User identity in the workout module is now the Auth.js session email.
// The literal-union ('tom' | 'tomer' | 'amit') and the `USER_IDS` enum
// constraint went away in the SSO rollout (PR 4); existing Mongo data
// was backfilled to emails by scripts/migrate-workout-userids-to-emails.mjs.
export type UserId = string;

export interface User {
  id: UserId;       // canonical email
  name: string;     // display name
}

// Static display-name table for the historic three users. Any other
// allowlisted email gets a name derived from the local-part. Adding a
// known friend is one line here.
export const KNOWN_USERS: Readonly<Record<string, string>> = Object.freeze({
  'tomzari347@gmail.com': 'Tom',
  'levtomer66@gmail.com': 'Tomer',
  'amitz2002@gmail.com':  'Amit',
});

export function getUserDisplayName(email: string | null | undefined): string {
  if (!email) return '';
  const lower = email.toLowerCase();
  if (KNOWN_USERS[lower]) return KNOWN_USERS[lower];
  // Fallback: take the local-part, prettify '_'/'.' → space, Title-Case.
  const local = lower.split('@')[0];
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Convenience: known-user list, mostly for legacy callers that wanted to
// iterate "the users". Anyone outside this list is still a valid UserId
// (any signed-in email is a valid identity).
export const USERS: User[] = Object.entries(KNOWN_USERS).map(([email, name]) => ({
  id: email,
  name,
}));

export const USER_IDS: readonly UserId[] = USERS.map((u) => u.id);

// Validates that a value is shaped like a non-empty user-id (any string
// that's plausibly an email). The actual authorization happens at the
// API layer by comparing against `session.user.email`.
export function isValidUserId(value: unknown): value is UserId {
  return typeof value === 'string' && value.length > 0 && value.includes('@');
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
  | 'forearms'
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
  { id: 'forearms', label: 'Forearms', icon: '🤜' },
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
  | 'forearms'
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

// A set is in time-mode when it has a `seconds` field. Loose `!= null`
// covers both null and undefined — legacy workouts saved before the
// `seconds` field was added arrive over the wire without the field at
// all, so a strict `!== null` would misclassify them as time-mode and
// surface "0:00" instead of their reps.
export function isTimeSet(s: WorkoutSet): boolean {
  return s.seconds != null;
}

// Epley estimated 1RM formula with rep count capped at 10. Above that,
// the formula systematically over-estimates because muscular endurance
// dominates strength at high rep counts. 10 is the cap used by Strong,
// Hevy, and most lifter-facing apps.
//
//   e1RM = kg × (1 + min(reps, 10) / 30)
//
// Returns 0 for any input that doesn't represent a real rep-mode set
// (missing weight, missing reps, zero values, time-mode-only sets).
// Use the return value comparator-style — "higher e1RM is a better
// set" — rather than treating it as a precise predicted lift.
export const E1RM_REP_CAP = 10;
export function epleyE1rm(kg: number | null | undefined, reps: number | null | undefined): number {
  // Reject anything that isn't a real, finite, positive measurement.
  // NaN / Infinity / fractional-from-bad-input would otherwise propagate
  // silently through the formula and only get dropped downstream (Codex
  // P2). Round reps so a stray fractional value (e.g. parsed "8.5")
  // doesn't skew the estimate.
  if (kg == null || reps == null) return 0;
  if (!Number.isFinite(kg) || !Number.isFinite(reps)) return 0;
  if (kg <= 0 || reps <= 0) return 0;
  const cappedReps = Math.min(Math.round(reps), E1RM_REP_CAP);
  return kg * (1 + cappedReps / 30);
}

// Highest e1RM achieved across the rep-mode sets in a single workout's
// exercise entry, plus the set that produced it. Used to find PBs and
// to draw the progress chart.
export interface BestE1rm {
  e1rm: number;
  kg: number;
  reps: number;
}
export function bestE1rmFromSets(sets: WorkoutSet[]): BestE1rm | null {
  let best: BestE1rm | null = null;
  for (const s of sets) {
    if (isTimeSet(s)) continue;  // time-mode sets get their own PB lane
    const e = epleyE1rm(s.kg, s.reps);
    if (e > 0 && (best === null || e > best.e1rm)) {
      best = { e1rm: e, kg: s.kg as number, reps: s.reps as number };
    }
  }
  return best;
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
  // When true AND userId is in OWNER_EMAILS, this template appears in
  // the "Workouts by Tomer" tab of the start-workout selector for
  // every signed-in user with workout permission. Only owners can set
  // this; the PUT handler ignores it for non-owners.
  sharedByOwner?: boolean;
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
  // Client-supplied UUID for idempotent creates. Lets the PWA
  // offline-queue safely replay a POST /workouts that the original
  // request may have actually completed (response just never arrived).
  clientRequestId?: string | null;
}

// Personal Best record
export interface PersonalBest {
  userId: UserId;
  exerciseId: string;
  // Best e1RM the user has ever achieved on this exercise (Epley, rep
  // count capped at 10). Acts as the unified PB comparator across rep
  // ranges — 100 × 5 and 80 × 10 are comparable as e1RM ≈ 117 vs 107.
  // Null when the user has never logged a rep-mode set for this exercise.
  bestE1rm: number | null;
  bestKg: number | null;        // kg from the set that produced the PB
  bestReps: number | null;      // reps from the set that produced the PB
  bestDate: string | null;
  bestWorkoutId: string | null;
  // Most-recent occurrence (used for prefill + recommendation context).
  // Distinct from "best" — `currentKg` tracks the latest weight the user
  // worked on, regardless of whether it was a PB.
  currentKg: number;
  currentReps: number[];
  currentDate: string;
  currentWorkoutId: string;
  // Recommendation: small bump from the PB-producing weight when the
  // user matches their PB; otherwise just the current working weight.
  recommendedKg: number;
  // Time-mode PB tracked in parallel — same exercise can have both a
  // rep-based and a time-based PB (e.g. weighted plank).
  bestSeconds: number | null;
  bestSecondsKg: number | null;
  bestSecondsDate: string | null;
  bestSecondsWorkoutId: string | null;
  // The actual `sets` array from the user's MOST RECENT occurrence of this
  // exercise — preserved verbatim so the active-workout view can prefill
  // new sets with the same kg/reps the user lifted last time. Distinct
  // from `currentReps` which only tracks reps at the highest weight.
  // Absent when the user has never logged this exercise.
  lastSets?: WorkoutSet[];
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

// "Completed" = the user finished logging all the sets on this
// exercise. Rep-mode sets need both kg and reps; time-mode sets need
// seconds > 0. Previously this gated on a magic ">8 reps at top
// weight" rule that conflated training effort with PB-worthiness; we
// dropped that — PB-worthiness is now e1RM-based and handled by the
// PersonalBest endpoint. This helper now answers a simpler UX
// question: "is the user done entering data for this exercise?" so
// the card border can flip green when nothing else is expected.
export function isExerciseCompleted(exercise: WorkoutExercise): boolean {
  if (exercise.sets.length === 0) return false;
  return exercise.sets.every((s) => {
    if (isTimeSet(s)) return (s.seconds as number) > 0;
    return s.kg !== null && s.kg > 0 && s.reps !== null && s.reps > 0;
  });
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
