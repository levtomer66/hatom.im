import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_WEIGHT_KG,
  MAX_LEVEL,
  kgToMeters,
  levelTargetMeters,
  levelTargetKg,
  computeCarState,
  formatMeters,
  formatTons,
} from '../workout-car.ts';

test('1 ton lifted moves the car 1 m', () => {
  assert.equal(kgToMeters(CAR_WEIGHT_KG), 1);
  assert.equal(kgToMeters(2500), 2.5);
});

test('level targets grow 25% per level, rounded to whole metres', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(levelTargetMeters), [50, 63, 78, 98, 122, 153]);
  assert.equal(levelTargetKg(1), 50_000);
  assert.equal(levelTargetKg(2), 63_000);
  assert.equal(levelTargetMeters(0), 50);   // clamps below 1
  assert.equal(levelTargetMeters(2.9), 63); // floors fractions
});

test('a fresh feed is at level 1 with the car on the start line', () => {
  const s = computeCarState(0);
  assert.equal(s.level, 1);
  assert.equal(s.progressKg, 0);
  assert.equal(s.progress, 0);
  assert.equal(s.levelTargetKg, 50_000);
  assert.equal(s.remainingKg, 50_000);
});

test('halfway through level 1', () => {
  const s = computeCarState(25_000);
  assert.equal(s.level, 1);
  assert.equal(s.progress, 0.5);
  assert.equal(s.remainingKg, 25_000);
});

test('reaching the target exactly levels up and resets the track', () => {
  const s = computeCarState(50_000);
  assert.equal(s.level, 2);
  assert.equal(s.levelStartKg, 50_000);
  assert.equal(s.progressKg, 0);
  assert.equal(s.levelTargetKg, 63_000);

  const almost = computeCarState(49_999);
  assert.equal(almost.level, 1);
  assert.ok(almost.progress > 0.999 && almost.progress < 1);
});

test('levels accumulate: 50 000 + 63 000 + 1 000 kg is 1 000 kg into level 3', () => {
  const s = computeCarState(114_000);
  assert.equal(s.level, 3);
  assert.equal(s.levelStartKg, 113_000);
  assert.equal(s.progressKg, 1_000);
  assert.equal(s.levelTargetKg, 78_000);
});

test('garbage input is treated as zero', () => {
  assert.equal(computeCarState(-500).level, 1);
  assert.equal(computeCarState(NaN).totalKg, 0);
  assert.equal(computeCarState(Infinity).totalKg, 0);
});

test('level never decreases as the total grows, and is capped', () => {
  let prev = 0;
  for (let kg = 0; kg <= 2_000_000; kg += 7_777) {
    const s = computeCarState(kg);
    assert.ok(s.level >= prev, `level dropped at ${kg}`);
    assert.ok(s.progress >= 0 && s.progress <= 1);
    prev = s.level;
  }
  const huge = computeCarState(1e15);
  assert.equal(huge.level, MAX_LEVEL);
  assert.equal(huge.progress, 1);
});

test('formatMeters: one decimal under 100 m, whole metres above', () => {
  assert.equal(formatMeters(0), '0');
  assert.equal(formatMeters(2.34), '2.3');
  assert.equal(formatMeters(99.96), '100.0');
  assert.equal(formatMeters(123.6), '124');
  assert.equal(formatMeters(NaN), '0');
});

test('formatTons rounds to a tenth of a ton', () => {
  assert.equal(formatTons(12_345), '12.3');
  assert.equal(formatTons(950), '1.0');
  assert.equal(formatTons(0), '0');
});
