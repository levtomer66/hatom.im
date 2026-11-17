import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addToList, homeFromLists, parseList, parseMyItems, parsePicks, pickMissing, removeBought,
  type ListLine, type MyItem,
} from '../shopping/home.ts';

const line = (key: string, qty = 1, w = false, name = `item ${key}`): ListLine => ({ key, name, qty, w });
const mine = (key: string, qty = 1, w = false, addedBy = 'a@x', addedAt = '2026-01-01'): MyItem =>
  ({ ...line(key, qty, w), addedBy, addedAt });
const keys = (ls: { key: string }[]) => ls.map((l) => l.key);

test('parseList merges duplicates and rejects 101 lines', () => {
  const r = parseList([{ key: '7290000000001', name: 'חלב', qty: 1, w: false }, { key: '7290000000001', name: 'חלב', qty: 1, w: false }]);
  assert.ok(r.ok);
  assert.deepEqual(r.value, [{ key: '7290000000001', name: 'חלב', qty: 2, w: false }]);
  const many = parseList(Array.from({ length: 101 }, (_, i) => line(String(1000 + i))));
  assert.equal(many.ok, false);
  assert.match(!many.ok ? many.error : '', /100/);
});

test('parseMyItems keeps addedBy of existing items', () => {
  const r = parseMyItems([line('1'), line('2')], 'b@x', '2026-11-18', [mine('1')]);
  assert.ok(r.ok);
  assert.equal(r.value.find((i) => i.key === '1')?.addedBy, 'a@x');
  assert.equal(r.value.find((i) => i.key === '1')?.addedAt, '2026-01-01');
  assert.equal(r.value.find((i) => i.key === '2')?.addedBy, 'b@x');
  assert.equal(r.value.find((i) => i.key === '2')?.addedAt, '2026-11-18');
  const many = parseMyItems(Array.from({ length: 301 }, (_, i) => line(String(1000 + i))), 'b@x', 'now', []);
  assert.equal(many.ok, false);
});

test('parseMyItems rejects a bad key and a zero qty', () => {
  assert.equal(parseMyItems([line('abc')], 'b@x', 'now', []).ok, false);
  assert.equal(parseMyItems([line('1', 0)], 'b@x', 'now', []).ok, false);
});

test('parsePicks takes {add: [{key, qty}]} and rejects a non-array', () => {
  const r = parsePicks({ add: [{ key: '1', qty: 2 }] });
  assert.ok(r.ok);
  assert.deepEqual(r.value, [{ key: '1', qty: 2 }]);
  assert.equal(parsePicks({ add: 'x' }).ok, false);
  assert.equal(parsePicks({ add: [{ key: 'abc', qty: 1 }] }).ok, false);
});

test('pickMissing uses the given qty, falls back to usual, drops unknown keys', () => {
  const out = pickMissing([mine('1', 2), mine('2', 0.5, true)], [{ key: '1', qty: 3 }, { key: '2', qty: Number.NaN }, { key: '9', qty: 1 }]);
  assert.deepEqual(out.map((l) => [l.key, l.qty, l.w]), [['1', 3, false], ['2', 0.5, true]]);
  assert.equal(out[0].name, 'item 1');
});

test('addToList keeps an edited quantity and appends new keys', () => {
  const out = addToList([line('1', 5)], [line('1', 2), line('2', 1)]);
  assert.deepEqual(out.map((l) => [l.key, l.qty]), [['1', 5], ['2', 1]]);
});

test('addToList stops at 100 lines', () => {
  const full = Array.from({ length: 100 }, (_, i) => line(String(1000 + i)));
  assert.equal(addToList(full, [line('5')]).length, 100);
});

test('removeBought drops ticked unless not there', () => {
  assert.deepEqual(keys(removeBought([line('1'), line('2'), line('3')], ['1', '2'], ['2'])), ['2', '3']);
});

test('homeFromLists dedupes, keeps max qty and the latest name', () => {
  const items = homeFromLists([
    { items: [line('1', 3, false, 'ישן')], createdBy: 'o@x', updatedAt: '2026-01-01T00:00:00Z' },
    { items: [line('1', 1, false, 'חדש'), line('2')], createdBy: 'n@x', updatedAt: '2026-02-01T00:00:00Z' },
  ]);
  assert.equal(items.length, 2);
  const one = items.find((i) => i.key === '1')!;
  assert.equal(one.qty, 3);
  assert.equal(one.name, 'חדש');
  assert.equal(one.addedBy, 'n@x');
});
