import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replaceInTemplateList, moveLoadPref, isCustomExerciseId } from '../workout-replace-exercise.ts';

const e = (exerciseId: string, numSets = 3, notes = '') => ({ exerciseId, numSets, notes });

test('the custom becomes the built-in, in place, keeping its sets and notes', () => {
  const out = replaceInTemplateList([e('squat'), e('custom-1a2b3c4d', 4, 'slow'), e('lunge')], 'custom-1a2b3c4d', 'leg-press');
  assert.deepEqual(out, [e('squat'), e('leg-press', 4, 'slow'), e('lunge')]);
});

test('a template that already has the built-in keeps one entry, the first one', () => {
  assert.deepEqual(
    replaceInTemplateList([e('leg-press', 5), e('custom-1a2b3c4d', 2)], 'custom-1a2b3c4d', 'leg-press'),
    [e('leg-press', 5)],
  );
  assert.deepEqual(
    replaceInTemplateList([e('custom-1a2b3c4d', 2), e('leg-press', 5)], 'custom-1a2b3c4d', 'leg-press'),
    [e('leg-press', 2)],
  );
});

test('a template without the custom is returned unchanged', () => {
  const list = [e('squat'), e('lunge')];
  assert.deepEqual(replaceInTemplateList(list, 'custom-1a2b3c4d', 'leg-press'), list);
});

test('gear preference moves to the built-in unless it already has one', () => {
  assert.deepEqual(moveLoadPref({ 'custom-1a2b3c4d': 'A' }, 'custom-1a2b3c4d', 'squat'), { set: { squat: 'A' }, unset: ['custom-1a2b3c4d'] });
  assert.deepEqual(moveLoadPref({ 'custom-1a2b3c4d': 'A', squat: 'B' }, 'custom-1a2b3c4d', 'squat'), { set: {}, unset: ['custom-1a2b3c4d'] });
  assert.deepEqual(moveLoadPref({ squat: 'B' }, 'custom-1a2b3c4d', 'squat'), { set: {}, unset: [] });
});

test('custom ids', () => {
  assert.ok(isCustomExerciseId('custom-e609e9b2'));
  assert.ok(!isCustomExerciseId('squat'));
  assert.ok(!isCustomExerciseId('custom-x'));
});
