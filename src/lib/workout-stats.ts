import { Workout, isTimeSet } from '@/types/workout';

// Sets logged, exercises completed, and total lifted volume (kg) for a
// workout. Shared by the completion summary and the feed-share endpoint so
// the numbers a user sees on completion match the snapshot stored in a post.
// A set counts when it has real data: rep-mode needs reps > 0 (weight is
// optional — a bodyweight/calisthenics set still counts, it just adds 0 to
// volume); time-mode needs seconds > 0 (no volume).
export interface WorkoutStats {
  setsLogged: number;
  exercisesDone: number;
  exercisesTotal: number;
  totalVolumeKg: number;
}

export function computeWorkoutStats(workout: Pick<Workout, 'exercises'>): WorkoutStats {
  let setsLogged = 0;
  let exercisesDone = 0;
  let totalVolumeKg = 0;
  for (const ex of workout.exercises) {
    let anySet = false;
    for (const s of ex.sets) {
      if (!isTimeSet(s) && s.reps !== null && s.reps > 0) {
        setsLogged += 1;
        if (s.kg !== null) totalVolumeKg += s.kg * s.reps; // bodyweight adds 0
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
