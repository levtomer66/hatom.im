import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQty, parseListCreate, parseListPatch, searchTerms, MAX_LIST_ITEMS } from '../shopping/lists.ts';

test('normalizeQty: whole units, 0.05 kg steps for weighted, bounds', () => {
  assert.equal(normalizeQty(2.4, false), 2);
  assert.equal(normalizeQty(0.4, false), null);
  assert.equal(normalizeQty(0.53, true), 0.55);
  assert.equal(normalizeQty(0, true), null);
  assert.equal(normalizeQty(101, false), null);
  assert.equal(normalizeQty(Number.NaN, false), null);
});

test('create needs a 1–60 character name', () => {
  assert.deepEqual(parseListCreate({ name: '  שבועי ' }), { ok: true, value: { name: 'שבועי' } });
  assert.equal(parseListCreate({ name: '   ' }).ok, false);
  assert.equal(parseListCreate({ name: 'x'.repeat(61) }).ok, false);
  assert.equal(parseListCreate(null).ok, false);
});

test('patch validates items, merges duplicates, and needs something to change', () => {
  const r = parseListPatch({
    items: [
      { key: '7290000000001', name: 'חלב', qty: 1, w: false },
      { key: '7290000000001', name: 'חלב', qty: 2 },
      { key: '7290027600007:123', name: 'עגבניות', qty: 1.23, w: true },
    ],
  });
  assert.ok(r.ok);
  assert.deepEqual(r.value.items, [
    { key: '7290000000001', name: 'חלב', qty: 3, w: false },
    { key: '7290027600007:123', name: 'עגבניות', qty: 1.25, w: true },
  ]);
  assert.equal(parseListPatch({}).ok, false);
  assert.equal(parseListPatch({ items: [{ key: 'a b', name: 'x', qty: 1 }] }).ok, false);
  assert.equal(parseListPatch({ items: [{ key: '123', name: 'x', qty: -1 }] }).ok, false);
  assert.equal(parseListPatch({ items: Array(MAX_LIST_ITEMS + 1).fill({ key: '1', name: 'x', qty: 1 }) }).ok, false);
});

test('searchTerms escapes regex and folds Hebrew quote marks', () => {
  assert.deepEqual(searchTerms('  חלב   3% '), ['חלב', '3%']);
  assert.deepEqual(searchTerms('a.b (c)'), ['a\\.b', '\\(c\\)']);
  const [t] = searchTerms('ק״ג');
  for (const s of ['ק"ג', 'ק״ג', "ק'ג"]) assert.match(s, new RegExp(t));
  assert.equal(searchTerms('1 2 3 4 5 6 7').length, 5);
});
