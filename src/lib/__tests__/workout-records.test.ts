import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestRow, computeVolumeRecords, recordBadgeFor, recordProgress } from '../workout-records.ts';

const post = (userId: string, kg: number, workoutId: string, workoutDate = '2026-01-01') => ({
  userId,
  kg,
  workoutId,
  workoutDate,
});

test('picks each user best and the overall holder, heaviest first', () => {
  const r = computeVolumeRecords(
    [post('a', 5000, 'w1'), post('a', 7000, 'w2'), post('b', 9000, 'w3'), post('b', 0, 'w4')],
    (id) => id.toUpperCase(),
  );
  assert.deepEqual(r.byUser.map((x) => [x.userId, x.workoutId, x.displayName]), [
    ['b', 'w3', 'B'],
    ['a', 'w2', 'A'],
  ]);
  assert.equal(r.group?.workoutId, 'w3');
});

test('ties keep the earlier workout', () => {
  const r = computeVolumeRecords(
    [post('a', 100, 'late', '2026-02-01'), post('a', 100, 'early', '2026-01-01')],
    (id) => id,
  );
  assert.equal(r.byUser[0].workoutId, 'early');
});

test('empty feed has no records', () => {
  const r = computeVolumeRecords([], (id) => id);
  assert.equal(r.group, null);
  assert.equal(recordBadgeFor(r, { workoutId: 'x', userId: 'a' }), null);
});

test('recordBadgeFor: group outranks personal', () => {
  const r = computeVolumeRecords([post('a', 10, 'w1'), post('b', 5, 'w2'), post('b', 3, 'w3')], (id) => id);
  assert.equal(recordBadgeFor(r, { workoutId: 'w1', userId: 'a' }), 'group');
  assert.equal(recordBadgeFor(r, { workoutId: 'w2', userId: 'b' }), 'personal');
  assert.equal(recordBadgeFor(r, { workoutId: 'w3', userId: 'b' }), null);
});

test('recordProgress clamps and handles a missing record', () => {
  assert.equal(recordProgress(50, 100), 0.5);
  assert.equal(recordProgress(150, 100), 1);
  assert.equal(recordProgress(10, null), null);
  assert.equal(recordProgress(10, 0), null);
});

test('bestRow picks the heaviest, earlier on ties, ignoring zero volume', () => {
  assert.equal(bestRow([]), null);
  assert.equal(bestRow([post('a', 0, 'z')]), null);
  assert.equal(
    bestRow([post('a', 9, 'late', '2026-03-01'), post('a', 9, 'early', '2026-02-01'), post('a', 3, 'x')])?.workoutId,
    'early',
  );
});
