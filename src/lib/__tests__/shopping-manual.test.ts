import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseManualPrice, withManualPrices } from '../shopping/manual.ts';

test('parse: whole agorot within range, or null to clear', () => {
  assert.deepEqual(parseManualPrice({ store: 7, item: '7290000497044', price: 1790 }), { store: 7, item: '7290000497044', price: 1790 });
  assert.deepEqual(parseManualPrice({ store: 7, item: '7290000497044', price: null }), { store: 7, item: '7290000497044', price: null });
  assert.equal(typeof parseManualPrice({ store: 7, item: 'x', price: 17.9 }), 'string');
  assert.equal(typeof parseManualPrice({ store: 7, item: 'x', price: 0 }), 'string');
  assert.equal(typeof parseManualPrice({ store: 7, item: 'x', price: 100_001 }), 'string');
  assert.equal(typeof parseManualPrice({ store: '7', item: 'x', price: 100 }), 'string');
  assert.equal(typeof parseManualPrice({ store: 7, item: '', price: 100 }), 'string');
});

test('typed prices join the item price maps without mutating them', () => {
  const bread = { n: 'לחם', p: { 1: 1790 } as Record<string, number> };
  const items = new Map([['b', bread]]);
  const out = withManualPrices(items, [
    { s: 99, i: 'b', p: 1500 },
    { s: 99, i: 'missing', p: 100 },
  ]);
  assert.deepEqual(out.get('b')?.p, { 1: 1790, 99: 1500 });
  assert.deepEqual(bread.p, { 1: 1790 });
  assert.equal(out.has('missing'), false);
  assert.equal(withManualPrices(items, []), items);
});
