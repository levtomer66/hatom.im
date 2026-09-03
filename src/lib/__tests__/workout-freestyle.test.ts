import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  templateExercisesFromWorkout,
  type WorkoutExercise,
  type WorkoutSet,
} from '../../types/workout.ts';

const set = (kg: number | null = 40, reps: number | null = 8): WorkoutSet => ({ kg, reps, seconds: null });

function ex(partial: Partial<WorkoutExercise> & { exerciseId: string; order: number }): WorkoutExercise {
  return { id: `id-${partial.exerciseId}`, sets: [set(), set(), set()], notes: '', photos: [], ...partial };
}

test('keeps the workout order, set count, notes and superset groups', () => {
  const out = templateExercisesFromWorkout([
    ex({ exerciseId: 'b', order: 2, sets: [set(), set()], notes: 'slow tempo', supersetGroup: 1 }),
    ex({ exerciseId: 'a', order: 1, sets: [set(), set(), set(), set()], supersetGroup: 1 }),
    ex({ exerciseId: 'c', order: 3, sets: [set()] }),
  ]);
  assert.deepEqual(out, [
    { exerciseId: 'a', numSets: 4, notes: '', supersetGroup: 1 },
    { exerciseId: 'b', numSets: 2, notes: 'slow tempo', supersetGroup: 1 },
    { exerciseId: 'c', numSets: 1, notes: '', supersetGroup: null },
  ]);
});

test('clamps set counts to the template range and defaults an empty exercise', () => {
  const out = templateExercisesFromWorkout([
    ex({ exerciseId: 'many', order: 1, sets: Array.from({ length: 7 }, () => set()) }),
    ex({ exerciseId: 'none', order: 2, sets: [] }),
  ]);
  assert.equal(out[0].numSets, 5);
  assert.equal(out[1].numSets, 3);
});

test('a swapped exercise is saved under its final id', () => {
  const out = templateExercisesFromWorkout([
    ex({ exerciseId: 'incline-bench', order: 1, replacedFromExerciseId: 'bench-press' }),
  ]);
  assert.equal(out[0].exerciseId, 'incline-bench');
});
