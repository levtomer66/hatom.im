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

// ---- how many stores is worth it ----

import { worthCount } from '../shopping/plans.ts';

const opt = (count: number, total: number, missing = 0) => ({ count, total, missing });

test('each extra store must save SPLIT_MIN_SAVING over one store fewer', () => {
  // two stores save ₪20 over one; the third only ₪2 more → two
  assert.equal(worthCount([opt(1, 10000), opt(2, 8000), opt(3, 7800)]), 2);
  // each step saves ₪15 → three
  assert.equal(worthCount([opt(1, 10000), opt(2, 10000 - SPLIT_MIN_SAVING), opt(3, 10000 - 2 * SPLIT_MIN_SAVING)]), 3);
  // nothing pays → one
  assert.equal(worthCount([opt(1, 10000), opt(2, 9990), opt(3, 9980)]), 1);
});

test('a count that covers more items is worth it whatever the price', () => {
  assert.equal(worthCount([opt(1, 5000, 2), opt(2, 9000, 0)]), 2);
  assert.equal(worthCount([opt(1, 5000, 1), opt(2, 5000, 1), opt(3, 9000, 0)]), 3);
});

test('a skipped count is compared against the last one taken', () => {
  // three saves ₪16 over one but only ₪1 over two, and two alone doesn't pay → still three
  assert.equal(worthCount([opt(1, 10000), opt(2, 8500 + 1000), opt(3, 8400)]), 3);
  // only one and three exist
  assert.equal(worthCount([opt(1, 10000), opt(3, 8000)]), 3);
  assert.equal(worthCount([]), 1);
});
