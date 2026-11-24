import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRead, emptyRecipe, newIngredient, parseRecipePatch, parseSaveArgs } from '../recipes/recipe.ts';
import type { Recipe } from '../recipes/types.ts';

const line = { id: 'i1', text: '2 ביצים', qty: 2, unit: null, name: 'ביצים', grams: 110, link: null, key: null, orig: null, alt: null, auto: false };

test('patch accepts only sent fields', () => assert.deepEqual(parseRecipePatch({ steps: ['a'] }), { ok: true, value: { steps: ['a'] } }));
test('ingredients patch carries no steps (no stale overwrite)', () => {
  const r = parseRecipePatch({ ingredients: [line] });
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.value), ['ingredients']);
});
test('unknown keys dropped', () => assert.deepEqual(parseRecipePatch({ owner: 'x', name: 'n' }), { ok: true, value: { name: 'n' } }));
test('limits', () => {
  assert.equal(parseRecipePatch({ name: 'x'.repeat(121) }).ok, false);
  assert.equal(parseRecipePatch({ name: '  ' }).ok, false);
  assert.equal(parseRecipePatch({ servings: 0 }).ok, false);
  assert.equal(parseRecipePatch({ servings: 1.5 }).ok, false);
  assert.equal(parseRecipePatch({ steps: Array(41).fill('s') }).ok, false);
  assert.equal(parseRecipePatch({ ingredients: Array(61).fill(line) }).ok, false);
  assert.equal(parseRecipePatch({ prepMin: 1441 }).ok, false);
  assert.equal(parseRecipePatch({ notes: 'x'.repeat(2001) }).ok, false);
});
test('null minutes allowed', () => assert.deepEqual(parseRecipePatch({ prepMin: null }), { ok: true, value: { prepMin: null } }));
test('tags trimmed and deduped', () => {
  const r = parseRecipePatch({ tags: [' ערב ', 'ערב', 'טבעוני', ''] });
  assert.ok(r.ok); assert.deepEqual(r.value.tags, ['ערב', 'טבעוני']);
});
test('shared flag', () => assert.deepEqual(parseRecipePatch({ shared: true }), { ok: true, value: { shared: true } }));
test('bad link rejected', () => {
  const bad = { ...line, link: { ref: { kind: 'meal', key: '1' }, name: 'x', img: null, per100: { kcal: 1, p: 1, c: 1, f: 1 } } };
  assert.equal(parseRecipePatch({ ingredients: [bad] }).ok, false);
  const neg = { ...line, link: { ref: { kind: 'food', key: '1' }, name: 'x', img: null, per100: { kcal: -1, p: 1, c: 1, f: 1 } } };
  assert.equal(parseRecipePatch({ ingredients: [neg] }).ok, false);
});
test('good link kept', () => {
  const good = { ...line, link: { ref: { kind: 'product', key: '7290000000001' }, name: 'x', img: null, per100: { kcal: 100, p: 1, c: 2, f: 3 } } };
  const r = parseRecipePatch({ ingredients: [good] });
  assert.ok(r.ok); assert.deepEqual(r.value.ingredients?.[0].link, good.link);
});

test('newIngredient', () => assert.deepEqual(newIngredient('3 ביצים', 'i1'),
  { id: 'i1', text: '3 ביצים', qty: 3, unit: null, name: 'ביצים', grams: 165, link: null, key: null, orig: null, alt: null, auto: false }));
test('emptyRecipe', () => { const e = emptyRecipe(); assert.equal(e.name, 'מתכון חדש'); assert.equal(e.servings, 2); assert.deepEqual(e.ingredients, []); });

test('save args map', () => {
  const r = parseSaveArgs({ name: 'פנקייק', servings: 4, ingredients: [{ text: '1 כוס קמח', orig: '1 cup flour', alt: null }], steps: ['לערבב'], image_url: 'https://cdn/x.jpg', prep_min: 5 });
  assert.ok(r.ok);
  const ing = r.value.recipe.ingredients![0];
  assert.equal(ing.orig, '1 cup flour'); assert.equal(ing.id, 'i1'); assert.equal(ing.qty, 1); assert.equal(ing.grams, 127);
  assert.equal(r.value.imageUrl, 'https://cdn/x.jpg');
  assert.equal(r.value.recipe.prepMin, 5);
});
test('save args errors name the field', () => assert.deepEqual(parseSaveArgs({ name: 'x', servings: 2, ingredients: [{}], steps: [] }), { ok: false, error: 'ingredients[0].text is required' }));
test('save args need a name', () => assert.equal(parseSaveArgs({ servings: 2, ingredients: [], steps: [] }).ok, false));
test('save args reject non-http image', () => assert.equal(parseSaveArgs({ name: 'x', servings: 2, ingredients: [], steps: [], image_url: 'file:///etc' }).ok, false));

test('canRead', () => {
  const r = { owner: 'a@x', shared: null } as unknown as Recipe;
  assert.equal(canRead(r, 'a@x'), true);
  assert.equal(canRead(r, 'b@x'), false);
  assert.equal(canRead({ ...r, shared: { at: 'now' } }, 'b@x'), true);
});
