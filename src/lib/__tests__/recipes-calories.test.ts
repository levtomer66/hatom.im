import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeEntry, recipeHit } from '../recipes/calories-link.ts';
import type { Ingredient, Recipe } from '../recipes/types.ts';

const ing = (o: Partial<Ingredient>): Ingredient => ({ id: 'a', text: '', qty: null, unit: null, name: '', grams: null, link: null, key: null, orig: null, alt: null, auto: false, ...o });
const P = { kcal: 200, p: 10, c: 20, f: 5 };
const link = { ref: { kind: 'food' as const, key: '1' }, name: 'x', img: null, per100: P };
const recipe = (ings: Ingredient[]): Recipe => ({
  id: 'r1', owner: 'a@x', name: 'פשטידה', servings: 4, ingredients: ings, steps: [], tags: [], prepMin: null, cookMin: null,
  photo: 'https://b/p.jpg', notes: '', source: null, shared: null, copiedFrom: null, createdAt: '', updatedAt: '',
});

test('no linked line → no hit, no entry', () => {
  const r = recipe([ing({ qty: 2, name: 'בצל' })]);
  assert.equal(recipeHit(r), null);
  assert.equal(recipeEntry(r, 1), null);
});
test('hit: per serving, unit grams per serving', () => {
  const h = recipeHit(recipe([ing({ qty: 1, grams: 400, link }), ing({ qty: 2, grams: 400, name: 'בצל' })]));
  assert.ok(h);
  assert.deepEqual(h.ref, { kind: 'recipe', key: 'r1' });
  assert.equal(h.source, 'recipe');
  assert.equal(h.per100, null);
  assert.deepEqual(h.per, { kcal: 200, p: 10, c: 20, f: 5 });
  assert.deepEqual(h.units, [{ name: 'מנה', g: 200 }]);
  assert.equal(h.img, 'https://b/p.jpg');
});
test('entry for 2 servings', () => {
  const e = recipeEntry(recipe([ing({ qty: 1, grams: 400, link })]), 2);
  assert.ok(e);
  assert.equal(e.nu.kcal, 400);
  assert.deepEqual(e.base, { qty: 2, nu: e.nu });
  assert.deepEqual(e.unit, { name: 'מנה', g: 100 });
  assert.equal(e.qty, 2);
});
