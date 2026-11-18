import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQty, searchTerms } from '../shopping/lists.ts';

test('normalizeQty: whole units, 0.05 kg steps for weighted, bounds', () => {
  assert.equal(normalizeQty(2.4, false), 2);
  assert.equal(normalizeQty(0.4, false), null);
  assert.equal(normalizeQty(0.53, true), 0.55);
  assert.equal(normalizeQty(0, true), null);
  assert.equal(normalizeQty(101, false), null);
  assert.equal(normalizeQty(Number.NaN, false), null);
});

test('searchTerms escapes regex and folds Hebrew quote marks', () => {
  assert.deepEqual(searchTerms('  חלב   3% '), ['חלב', '3%']);
  assert.deepEqual(searchTerms('a.b (c)'), ['a\\.b', '\\(c\\)']);
  const [t] = searchTerms('ק״ג');
  for (const s of ['ק"ג', 'ק״ג', "ק'ג"]) assert.match(s, new RegExp(t));
  assert.equal(searchTerms('1 2 3 4 5 6 7').length, 5);
});
