import { Workout, isTimeSet } from '@/types/workout';
import { effectiveSetKg } from '@/lib/workout-load';

// Sets logged, exercises completed, and total lifted volume (kg) for a
// workout. Shared by the completion summary and the feed-share endpoint so
// the numbers a user sees on completion match the snapshot stored in a post.
// A set counts when it has real data: rep-mode needs reps > 0 (weight is
// optional); time-mode needs seconds > 0 (no volume).
//
// Volume per rep-set = effectiveSetKg(...) × reps, where effectiveSetKg maps
// the entered weight to the ACTUAL load moved using the exercise's frozen
// load context (`ex.load`) and the workout's bodyweight snapshot
// (`workout.bodyweightKg`): a bodyweight set adds bodyweight × factor even
// when its `kg` is null; a per-side barbell set adds the bar + both sides.
// With no load context (legacy/standard) this collapses to entered kg × reps.
export interface WorkoutStats {
  setsLogged: number;
  exercisesDone: number;
  exercisesTotal: number;
  totalVolumeKg: number;
}

export function computeWorkoutStats(
  workout: Pick<Workout, 'exercises' | 'bodyweightKg'>,
): WorkoutStats {
  let setsLogged = 0;
  let exercisesDone = 0;
  let totalVolumeKg = 0;
  const bodyweightKg = workout.bodyweightKg ?? null;
  for (const ex of workout.exercises) {
    let anySet = false;
    for (const s of ex.sets) {
      if (!isTimeSet(s) && s.reps !== null && s.reps > 0) {
        setsLogged += 1;
        totalVolumeKg += effectiveSetKg(s.kg, ex.load, bodyweightKg) * s.reps;
        anySet = true;
      } else if (isTimeSet(s) && (s.seconds ?? 0) > 0) {
        setsLogged += 1;
        anySet = true;
      }
    }
    if (anySet) exercisesDone += 1;
  }
  return {
    setsLogged,
    exercisesDone,
    exercisesTotal: workout.exercises.length,
    totalVolumeKg,
  };
}
