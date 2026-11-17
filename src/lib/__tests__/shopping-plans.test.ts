import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choosePlan, splitPays, SPLIT_MIN_SAVING } from '../shopping/plans.ts';

const b = (store: number, costs: Record<string, number>) => ({
  store,
  lines: Object.entries(costs).map(([key, cost]) => ({ key, cost, available: true })),
});

test('picks each item at its cheapest store, at most three stores', () => {
  const baskets = [
    b(1, { a: 100, b: 500, c: 500, d: 500 }),
    b(2, { a: 500, b: 100, c: 500, d: 500 }),
    b(3, { a: 500, b: 500, c: 100, d: 500 }),
    b(4, { a: 500, b: 500, c: 500, d: 100 }),
  ];
  const p = choosePlan(baskets, ['a', 'b', 'c', 'd'])!;
  assert.equal(p.stores.length, 3); // four would be cheaper, but three is the cap
  assert.equal(p.estimate, 100 * 3 + 500);
  assert.deepEqual(p.missing, []);
});

test('covering every item beats a cheaper plan with a gap', () => {
  const baskets = [b(1, { a: 100 }), b(2, { a: 900, b: 900 })];
  const p = choosePlan(baskets, ['a', 'b'], 1)!;
  assert.deepEqual(p.stores, [2]);
  assert.deepEqual(p.missing, []);
});

test('a store that ends up buying nothing is dropped', () => {
  const baskets = [b(1, { a: 100, b: 100 }), b(2, { a: 200, b: 200 })];
  const p = choosePlan(baskets, ['a', 'b'])!;
  assert.deepEqual(p.stores, [1]);
});

test('items nobody sells are missing; no stores at all is null', () => {
  const p = choosePlan([b(1, { a: 100 })], ['a', 'z'])!;
  assert.deepEqual(p.missing, ['z']);
  assert.equal(choosePlan([], ['a']), null);
});

test('a split pays only from ₪15', () => {
  assert.equal(SPLIT_MIN_SAVING, 1500);
  assert.equal(splitPays(10000, 11500), true);
  assert.equal(splitPays(10000, 11499), false);
});
