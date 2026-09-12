import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCreatedWorkout } from '../workout-offline.ts';

test('isCreatedWorkout is true for a real created workout (201)', () => {
  assert.equal(isCreatedWorkout({ id: 'abc123', workoutName: 'Push', exercises: [] }), true);
});

test('isCreatedWorkout is true for an idempotent replay (200)', () => {
  assert.equal(isCreatedWorkout({ id: 'existing-id', isCompleted: false }), true);
});

test('isCreatedWorkout is false for the synthetic offline queued 202', () => {
  // This is exactly what public/workout-sw.js hands back when it queues the
  // create POST. Starting a session against it would lose the whole workout.
  assert.equal(isCreatedWorkout({ queued: true, queuedAt: '2026-09-12T10:00:00.000Z' }), false);
});

test('isCreatedWorkout is false for a body with no/empty id', () => {
  assert.equal(isCreatedWorkout({}), false);
  assert.equal(isCreatedWorkout({ id: '' }), false);
  assert.equal(isCreatedWorkout({ id: 123 }), false);
  assert.equal(isCreatedWorkout(null), false);
  assert.equal(isCreatedWorkout(undefined), false);
  assert.equal(isCreatedWorkout('nope'), false);
});
