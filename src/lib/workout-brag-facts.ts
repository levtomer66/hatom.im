import type { Workout } from '@/types/workout';
import { isTimeSet } from '@/types/workout';
import { effectiveSetKg } from '@/lib/workout-load';
import { computeWorkoutStats } from '@/lib/workout-stats';
import { getExerciseById } from '@/data/exercise-library';
import type { BragFacts } from '@/lib/workout-brag';

type WorkoutLike = Pick<Workout, 'exercises' | 'bodyweightKg'> & {
  createdAt?: string | Date;
};

// The facts the joke picker (chooseBrag in workout-brag.ts) works from, for
// one just-completed workout. Volume is counted exactly like
// computeWorkoutStats so the joke agrees with the number on the summary.
export function bragFactsFor(
  workout: WorkoutLike,
  opts: { prevVolumeKg: number | null; localHour: number | null; now?: Date },
): BragFacts {
  const stats = computeWorkoutStats(workout);
  const bodyweightKg = workout.bodyweightKg ?? null;

  let reps = 0;
  let top: BragFacts['top'] = null;
  for (const ex of workout.exercises) {
    let exVolume = 0;
    let exReps = 0;
    for (const s of ex.sets) {
      if (isTimeSet(s) || s.reps === null || s.reps <= 0) continue;
      exReps += s.reps;
      exVolume += effectiveSetKg(s.kg, ex.load, bodyweightKg) * s.reps;
    }
    reps += exReps;
    if (exVolume > 0 && (!top || exVolume > top.volumeKg)) {
      top = {
        id: ex.exerciseId,
        name: getExerciseById(ex.exerciseId)?.name ?? ex.exerciseId,
        volumeKg: exVolume,
        reps: exReps,
      };
    }
  }

  let minutes: number | null = null;
  if (workout.createdAt) {
    const start = new Date(workout.createdAt).getTime();
    const end = (opts.now ?? new Date()).getTime();
    if (Number.isFinite(start) && end > start) minutes = (end - start) / 60000;
  }

  const hour = opts.localHour;
  return {
    totalVolumeKg: stats.totalVolumeKg,
    setsLogged: stats.setsLogged,
    reps,
    minutes,
    top,
    prevVolumeKg: opts.prevVolumeKg,
    localHour: typeof hour === 'number' && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null,
  };
}
