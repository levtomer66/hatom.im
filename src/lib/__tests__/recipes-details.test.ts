import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailsOf, detailsPatch } from '../recipes/details.ts';
import { copyInit } from '../recipes/recipe.ts';
import type { Recipe } from '../recipes/types.ts';

const recipe = {
  id: 'r1', owner: 'a@x', name: 'פסטה', description: 'מהיר', servings: 2, ingredients: [], steps: ['לבשל'], tags: ['ערב'],
  prepMin: 5, cookMin: 10, photo: null, notes: '', source: { url: 'http://old.example.com/r', by: null },
  shared: { at: '2026-11-25' }, copiedFrom: null, createdAt: '', updatedAt: '',
} as Recipe;

test('a stored http link does not block other edits and is not re-sent', () => {
  const d = { ...detailsOf(recipe), name: 'פסטה ברוטב' };
  const p = detailsPatch(d, recipe.source?.url ?? '');
  assert.ok(p);
  assert.equal(p.name, 'פסטה ברוטב');
  assert.ok(!('sourceUrl' in p));
});
test('a newly typed http link holds the group back', () => {
  assert.equal(detailsPatch({ ...detailsOf(recipe), sourceUrl: 'http://new.example.com' }, recipe.source?.url ?? ''), undefined);
});
test('a changed link is sent, cleared as empty', () => {
  assert.equal(detailsPatch({ ...detailsOf(recipe), sourceUrl: 'https://x.co/a' }, 'http://old.example.com/r')?.sourceUrl, 'https://x.co/a');
  assert.equal(detailsPatch({ ...detailsOf(recipe), sourceUrl: '' }, 'http://old.example.com/r')?.sourceUrl, '');
});
test('a copy keeps the description', () => {
  const c = copyInit(recipe, null);
  assert.equal(c.description, 'מהיר');
  assert.deepEqual(c.copiedFrom, { id: 'r1', owner: 'a@x' });
  assert.equal(c.photo, null);
});
