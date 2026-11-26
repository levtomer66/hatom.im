import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchDefaults } from '../recipes/to-list.ts';
import type { Ingredient } from '../recipes/types.ts';

const ing = (o: Partial<Ingredient>): Ingredient => ({ id: 'a', text: '', qty: null, unit: null, name: '', grams: null, link: null, key: null, orig: null, alt: null, auto: false, ...o });
const prod = (k: string, w = false) => ({ key: k, name: k, img: null, w });

test('pantry and on-list start unticked', () => {
  const ings = [ing({ id: 'a', qty: 1, name: 'מלח' }), ing({ id: 'b', qty: 2, name: 'חלב' }), ing({ id: 'c', qty: 1, name: 'קמח מלא' })];
  const m = matchDefaults(ings, new Map([['a', prod('1')], ['b', prod('2')], ['c', prod('3')]]), new Set(['2']), 1);
  assert.deepEqual(m.map((l) => l.ticked), [false, false, true]);
});
test('no product → unticked', () => assert.equal(matchDefaults([ing({ id: 'a', qty: 1, name: 'x' })], new Map([['a', null]]), new Set(), 1)[0].ticked, false));
test('missing from the map → no product', () => assert.equal(matchDefaults([ing({ id: 'a', qty: 1, name: 'x' })], new Map(), new Set(), 1)[0].product, null));
test('weighed amount', () => assert.equal(matchDefaults([ing({ id: 'a', qty: 500, unit: 'גרם', grams: 500, name: 'עוף' })], new Map([['a', prod('9', true)]]), new Set(), 1.5)[0].qty, 0.8));
test('weighed with no grams → 1 kg minimum 0.1', () => assert.equal(matchDefaults([ing({ id: 'a', qty: 2, name: 'עוף' })], new Map([['a', prod('9', true)]]), new Set(), 1)[0].qty, 1));
test('units → 1', () => assert.equal(matchDefaults([ing({ id: 'a', qty: 3, name: 'ביצים', grams: 165 })], new Map([['a', prod('9')]]), new Set(), 2)[0].qty, 1));
test('no-qty lines skipped', () => assert.equal(matchDefaults([ing({ id: 'a', name: 'מלח לפי הטעם' })], new Map(), new Set(), 1).length, 0));
test('text is the scaled line', () => assert.equal(matchDefaults([ing({ id: 'a', qty: 1, unit: 'כוס', name: 'חלב' })], new Map(), new Set(), 2)[0].text, '2 כוסות חלב'));
