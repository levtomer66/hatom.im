import {
  ExerciseDefinition,
  ExerciseLoadPref,
  SetLoadContext,
} from '@/types/workout';

// The default Olympic barbell/pole weight (kg) added when a barbell exercise
// is entered per-side and no explicit bar weight is configured.
export const DEFAULT_BAR_WEIGHT_KG = 20;

// A load context that changes nothing — plain 'standard' loading. The client
// skips stamping these onto a WorkoutExercise (absent load === standard), so
// legacy/standard exercises stay clean.
export function isTrivialLoad(load: SetLoadContext | null | undefined): boolean {
  return !load || load.mode === 'standard';
}

// The actual load moved for ONE rep of a set, given the frozen load context
// and the workout's bodyweight snapshot. This is the single source of truth
// for both volume (× reps) and the display badge, and it runs identically on
// client and server so the numbers always agree.
//
//   standard   → entered kg
//   bodyweight → bodyweight × factor + entered kg (entered = ADDED weight)
//   barbell    → per-side: 2 × entered + bar; otherwise entered
//   dumbbell   → per-dumbbell: 2 × entered; otherwise entered
export function effectiveSetKg(
  setKg: number | null | undefined,
  load: SetLoadContext | null | undefined,
  bodyweightKg: number | null | undefined,
): number {
  const entered = setKg ?? 0;
  const mode = load?.mode ?? 'standard';

  switch (mode) {
    case 'bodyweight': {
      const bw = bodyweightKg ?? 0;
      const factor = load?.factor ?? 1;
      return bw * factor + entered;
    }
    case 'barbell':
      return load?.entry === 'per-side'
        ? 2 * entered + (load?.barWeightKg ?? 0)
        : entered;
    case 'dumbbell':
      return load?.entry === 'per-dumbbell' ? 2 * entered : entered;
    default:
      return entered;
  }
}

// Build the frozen SetLoadContext to stamp on a WorkoutExercise, from the
// exercise's objective load mode (its definition) and the user's per-exercise
// entry preference (their gear override).
//
// The two features are intentionally decoupled:
//   - Bodyweight is an OBJECTIVE property of the exercise (def.loadMode), so a
//     pull-up counts bodyweight for everyone. Its `bodyweightFactor` is fixed.
//   - Per-side / per-dumbbell is the USER's entry habit (pref.entry) and works
//     on ANY non-bodyweight exercise without tagging the library — the chosen
//     entry mode itself carries the barbell (2×+bar) vs dumbbell (2×) math.
// Everything defaults to today's behaviour: no bodyweight tag + no pref → 'standard'.
export function resolveLoadContext(
  def: Pick<ExerciseDefinition, 'loadMode' | 'bodyweightFactor'> | null | undefined,
  pref: ExerciseLoadPref | null | undefined,
): SetLoadContext {
  if (def?.loadMode === 'bodyweight') {
    return { mode: 'bodyweight', factor: def.bodyweightFactor ?? 1 };
  }

  const entry = pref?.entry ?? 'total';
  if (entry === 'per-side') {
    return {
      mode: 'barbell',
      entry,
      barWeightKg: pref?.barWeightKg != null ? pref.barWeightKg : DEFAULT_BAR_WEIGHT_KG,
    };
  }
  if (entry === 'per-dumbbell') {
    return { mode: 'dumbbell', entry };
  }
  return { mode: 'standard' };
}
