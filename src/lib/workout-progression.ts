import { EXERCISE_LIBRARY, resolveExerciseId } from '@/data/exercise-library';
import { ProgressionStep } from '@/types/workout';

// exerciseId → its progression ladder, built once from the library. Only
// skill exercises appear here; barbell/machine exercises and customs are
// absent (they have no ladder), so lookups on them return undefined.
const PROGRESSION_BY_EXERCISE: Map<string, ProgressionStep[]> = new Map(
  EXERCISE_LIBRARY
    .filter((e) => e.progression && e.progression.length > 0)
    .map((e) => [e.id, e.progression as ProgressionStep[]]),
);

// Resolve aliases (e.g. lat-pulldown → wide-grip-lat-pulldown) before lookup
// so a workout that stored an aliased id still finds its ladder.
export function getProgression(exerciseId: string): ProgressionStep[] | undefined {
  return PROGRESSION_BY_EXERCISE.get(resolveExerciseId(exerciseId));
}

export function hasProgression(exerciseId: string): boolean {
  return getProgression(exerciseId) !== undefined;
}

export function getProgressionStep(
  exerciseId: string,
  stepId: string | null | undefined,
): ProgressionStep | undefined {
  if (!stepId) return undefined;
  return getProgression(exerciseId)?.find((s) => s.id === stepId);
}

// Index of a step on its ladder (-1 if unknown). Used to compare "frontier"
// progress — a higher index is a harder step.
export function stepIndex(exerciseId: string, stepId: string | null | undefined): number {
  if (!stepId) return -1;
  const ladder = getProgression(exerciseId);
  if (!ladder) return -1;
  return ladder.findIndex((s) => s.id === stepId);
}

// Permissive sanitizer: keep a stepId only when it names a real rung on THIS
// exercise's ladder; otherwise null it. Never throws — a stale/unknown id
// from an old client just drops to null (same spirit as resolveExerciseId).
export function sanitizeStepId(exerciseId: string, stepId: unknown): string | null {
  if (typeof stepId !== 'string') return null;
  return getProgressionStep(exerciseId, stepId) ? stepId : null;
}

// Mutate every set's stepId across a workout body's exercises in place,
// dropping ids that don't belong to the exercise's ladder. Tolerant of the
// loose JSON shape a route handler receives.
export function sanitizeExercisesStepIds(exercises: unknown): void {
  if (!Array.isArray(exercises)) return;
  for (const ex of exercises) {
    if (!ex || typeof ex !== 'object') continue;
    const exerciseId = (ex as { exerciseId?: unknown }).exerciseId;
    const sets = (ex as { sets?: unknown }).sets;
    if (typeof exerciseId !== 'string' || !Array.isArray(sets)) continue;
    for (const s of sets) {
      if (s && typeof s === 'object') {
        (s as { stepId?: string | null }).stepId = sanitizeStepId(
          exerciseId,
          (s as { stepId?: unknown }).stepId,
        );
      }
    }
  }
}
