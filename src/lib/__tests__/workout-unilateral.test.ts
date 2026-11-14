import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUnilateralSets,
  logicalSetCount,
  setNumber,
  hasLoggedRightSide,
  toUnilateral,
  toBilateral,
  resizeSets,
  shapePriorSets,
} from '../workout-unilateral.ts';
import type { WorkoutSet } from '../../types/workout.ts';

const s = (kg: number | null, reps: number | null, side?: 'left' | 'right'): WorkoutSet =>
  side ? { kg, reps, seconds: null, side } : { kg, reps, seconds: null };

test('toUnilateral splits each set into L (original) + R (same kg, unlogged)', () => {
  const out = toUnilateral([s(12, 10), s(14, 8)]);
  assert.deepEqual(out.map((x) => [x.side, x.kg, x.reps]), [
    ['left', 12, 10],
    ['right', 12, null],
    ['left', 14, 8],
    ['right', 14, null],
  ]);
  assert.equal(logicalSetCount(out), 2);
  assert.equal(isUnilateralSets(out), true);
});

test('toUnilateral keeps time-mode on the right partner with a zeroed clock', () => {
  const out = toUnilateral([{ kg: 0, reps: null, seconds: 45 }]);
  assert.equal(out[1].seconds, 0);
});

test('toBilateral keeps left, or right when only right is logged', () => {
  const out = toBilateral([s(10, 8, 'left'), s(10, 7, 'right'), s(12, null, 'left'), s(12, 6, 'right')]);
  assert.deepEqual(out.map((x) => [x.side, x.kg, x.reps]), [
    [null, 10, 8],
    [null, 12, 6],
  ]);
  assert.equal(isUnilateralSets(out), false);
});

test('round-trip of unsided data is a no-op', () => {
  const sets = [s(20, 5), s(20, 5)];
  assert.deepEqual(toBilateral(sets), sets);
});

test('setNumber numbers pairs by side', () => {
  const sets = toUnilateral([s(1, 1), s(2, 2)]);
  assert.equal(setNumber(sets, 0), 1);
  assert.equal(setNumber(sets, 3), 2);
  assert.equal(setNumber([s(1, 1), s(1, 1)], 1), 2);
});

test('hasLoggedRightSide only flags logged right rows', () => {
  assert.equal(hasLoggedRightSide(toUnilateral([s(10, 8)])), false);
  assert.equal(hasLoggedRightSide([s(10, 8, 'left'), s(10, 7, 'right')]), true);
});

test('resizeSets adds / trims whole pairs when unilateral', () => {
  const sets = toUnilateral([s(10, 10), s(10, 10)]);
  const up = resizeSets(sets, 3);
  assert.equal(up.length, 6);
  assert.deepEqual(up.slice(4).map((x) => x.side), ['left', 'right']);
  const down = resizeSets(sets, 1);
  assert.deepEqual(down.map((x) => x.side), ['left', 'right']);
  assert.equal(resizeSets([s(1, 1)], 3).length, 3);
});

test('shapePriorSets: bilateral history → unilateral slots copy each set to both sides', () => {
  const out = shapePriorSets([s(10, 8), s(12, 6)], 3, true);
  assert.deepEqual(out.map((x) => [x.side, x.kg]), [
    ['left', 10], ['right', 10],
    ['left', 12], ['right', 12],
    ['left', 12], ['right', 12],
  ]);
});

test('shapePriorSets: unilateral history keeps per-side weights', () => {
  const prior = [s(10, 8, 'left'), s(8, 8, 'right')];
  const uni = shapePriorSets(prior, 1, true);
  assert.deepEqual(uni.map((x) => [x.side, x.kg]), [['left', 10], ['right', 8]]);
  const bi = shapePriorSets(prior, 2, false);
  assert.deepEqual(bi.map((x) => [x.side, x.kg]), [[null, 10], [null, 10]]);
});
