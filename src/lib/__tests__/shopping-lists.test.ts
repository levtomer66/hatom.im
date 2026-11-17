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
  assert.deepEqual(parseListCreate({ name: '  שבועי ' }), { ok: true, value: { name: 'שבועי', shared: false } });
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

// ---- shared vs personal lists ----

import { canChangeSharing, canSee, isShared, parseListCreate as create, parseListPatch as patch } from '../shopping/lists.ts';

test('a list without the field (from before) counts as shared', () => {
  assert.equal(isShared({}), true);
  assert.equal(isShared({ shared: true }), true);
  assert.equal(isShared({ shared: false }), false);
});

test('a personal list is visible to its creator only; a shared one to everyone', () => {
  const personal = { shared: false, createdBy: 'tom@x' };
  assert.equal(canSee(personal, 'tom@x'), true);
  assert.equal(canSee(personal, 'tomer@x'), false);
  assert.equal(canSee({ createdBy: 'tom@x' }, 'tomer@x'), true);
  assert.equal(canSee({ shared: true, createdBy: 'tom@x' }, 'tomer@x'), true);
});

test('only the creator may change sharing', () => {
  assert.equal(canChangeSharing({ createdBy: 'tom@x' }, 'tom@x'), true);
  assert.equal(canChangeSharing({ createdBy: 'tom@x' }, 'tomer@x'), false);
});

test('a new list is personal unless asked; shared must be a boolean', () => {
  assert.deepEqual(create({ name: 'בית' }), { ok: true, value: { name: 'בית', shared: false } });
  assert.deepEqual(create({ name: 'בית', shared: true }), { ok: true, value: { name: 'בית', shared: true } });
  assert.equal(create({ name: 'בית', shared: 'yes' }).ok, false);
});

test('a patch can carry only `shared`', () => {
  assert.deepEqual(patch({ shared: false }), { ok: true, value: { shared: false } });
  assert.equal(patch({ shared: 1 }).ok, false);
  assert.equal(patch({}).ok, false);
});
