import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleLine } from '../recipes/scale.ts';
import { perServing } from '../recipes/nutrition.ts';
import { shareText } from '../recipes/share.ts';
import { isPantry } from '../recipes/pantry.ts';
import type { Ingredient, Recipe } from '../recipes/types.ts';

const ing = (o: Partial<Ingredient>): Ingredient => ({ id: 'a', text: '', qty: null, unit: null, name: '', grams: null, link: null, key: null, orig: null, alt: null, auto: false, ...o });
const P = { kcal: 364, p: 10, c: 76, f: 1 };
const link = { ref: { kind: 'food' as const, key: '1' }, name: 'קמח', img: null, per100: P };

test('scale cups to quarter', () => assert.equal(scaleLine(ing({ qty: 1, unit: 'כוס', name: 'קמח' }), 1.5), '1½ כוסות קמח'));
test('scale single cup keeps singular', () => assert.equal(scaleLine(ing({ qty: 2, unit: 'כוס', name: 'קמח' }), 0.5), '1 כוס קמח'));
test('scale below one cup', () => assert.equal(scaleLine(ing({ qty: 1, unit: 'כף', name: 'שמן' }), 0.5), '½ כף שמן'));
test('scale grams to 5', () => assert.equal(scaleLine(ing({ qty: 200, unit: 'גרם', name: 'חמאה' }), 1.33), '265 גרם חמאה'));
test('scale small grams whole', () => assert.equal(scaleLine(ing({ qty: 7, unit: 'גרם', name: 'שמרים' }), 1.5), '11 גרם שמרים'));
test('scale pieces', () => assert.equal(scaleLine(ing({ qty: 3, unit: null, name: 'ביצים' }), 0.5), '2 ביצים'));
test('scale pieces never zero', () => assert.equal(scaleLine(ing({ qty: 1, unit: null, name: 'בצל' }), 0.25), '1 בצל'));
test('factor 1 keeps the typed text', () => assert.equal(scaleLine(ing({ text: '2 כוסות קמח לבן', qty: 2, unit: 'כוס', name: 'קמח לבן' }), 1), '2 כוסות קמח לבן'));
test('no qty unchanged', () => assert.equal(scaleLine(ing({ text: 'מלח לפי הטעם', name: 'מלח לפי הטעם' }), 3), 'מלח לפי הטעם'));

test('per serving', () => assert.deepEqual(perServing({ servings: 2, ingredients: [ing({ qty: 1, grams: 200, link })] }),
  { totals: { kcal: 364, p: 10, c: 76, f: 1 }, partial: false }));
test('partial ignores no-qty lines', () => {
  const r = perServing({ servings: 1, ingredients: [ing({ qty: 1, grams: 100, link }), ing({ name: 'מלח' }), ing({ qty: 2, name: 'בצל' })] });
  assert.equal(r.partial, true);
  assert.equal(r.totals?.kcal, 364);
  assert.equal(perServing({ servings: 1, ingredients: [ing({ qty: 1, grams: 100, link }), ing({ name: 'מלח' })] }).partial, false);
});
test('all unlinked → null totals', () => assert.equal(perServing({ servings: 2, ingredients: [ing({ qty: 2, name: 'בצל' })] }).totals, null));
test('linked without grams is not counted', () => {
  const r = perServing({ servings: 1, ingredients: [ing({ qty: 1, unit: 'חבילה', link }), ing({ qty: 1, grams: 100, link })] });
  assert.equal(r.totals?.kcal, 364); assert.equal(r.partial, true);
});

test('share text', () => {
  const t = shareText({
    name: 'עוגה', servings: 4, prepMin: 10, cookMin: 30, notes: '', ingredients: [ing({ qty: 2, unit: 'כוס', name: 'קמח' })],
    steps: ['לערבב', 'לאפות'], source: { url: 'https://x.com/r', by: null },
  } as unknown as Recipe, 8);
  assert.match(t, /^\*עוגה\*/);
  assert.match(t, /8 מנות/);
  assert.match(t, /40 דק׳/);
  assert.match(t, /• 4 כוסות קמח/);
  assert.match(t, /1\. לערבב\n2\. לאפות/);
  assert.match(t, /https:\/\/x\.com\/r/);
});

test('pantry', () => {
  assert.ok(isPantry('מלח גס'));
  assert.ok(isPantry('שמן זית'));
  assert.ok(isPantry('מים'));
  assert.ok(!isPantry('שמנת מתוקה'));
  assert.ok(!isPantry('קמח מלא'));
});
