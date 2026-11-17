import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByDepartment, parseTripCreate, parseTripPatch, progress, withPending, type TripItem } from '../shopping/trips.ts';
import { DEPARTMENTS } from '../shopping/departments.ts';

const item = (key: string, d: string | null, cost = 100): TripItem => ({ key, name: key, qty: 1, w: false, cost, d, img: null });

test('groups by department in walking order, unknown departments last as "אחר"', () => {
  const [first, second] = DEPARTMENTS;
  const groups = groupByDepartment([item('x', null), item('b', second.id), item('a', first.id), item('y', 'nope')], new Set());
  assert.deepEqual(groups.map((g) => g.id), [first.id, second.id, 'other']);
  assert.equal(groups[2].name, 'אחר');
  assert.deepEqual(groups[2].items.map((i) => i.key), ['x', 'y']);
});

test('ticked items sink within their department; left counts the rest', () => {
  const d = DEPARTMENTS[0].id;
  const [g] = groupByDepartment([item('a', d), item('b', d), item('c', d)], new Set(['a']));
  assert.deepEqual(g.items.map((i) => i.key), ['b', 'c', 'a']);
  assert.equal(g.left, 2);
});

test('progress sums ticked costs against the estimate', () => {
  const p = progress({ estimate: 1000, ticked: ['a'], stops: [{ items: [item('a', null, 300), item('b', null, 700)] } as never] });
  assert.deepEqual(p, { done: 300, total: 1000, count: 1, of: 2 });
});

const body = {
  listId: '6afaca2b35b3a389faf7fa6d', plan: 'cheapest', city: 'tel-aviv', estimate: 1500,
  stops: [{ store: 3, storeName: 'שופרסל', items: [{ key: '7290000066318', name: 'במבה', qty: 2, cost: 1380, d: 'snacks', img: null }] }],
  missing: [{ key: '1', name: 'x' }],
};

test('a valid trip parses; bad ones say why', () => {
  const r = parseTripCreate(body);
  assert.equal(r.ok, true);
  assert.equal(parseTripCreate({ ...body, plan: 'any' }).ok, false);
  assert.equal(parseTripCreate({ ...body, stops: [] }).ok, false);
  const dup = { ...body, stops: [body.stops[0], { ...body.stops[0], store: 4 }] };
  assert.deepEqual(parseTripCreate(dup), { ok: false, error: 'item 7290000066318 is in two stops' });
  assert.equal(parseTripCreate({ ...body, estimate: -1 }).ok, false);
});

test('patch: tick or end, nothing else', () => {
  assert.deepEqual(parseTripPatch({ tick: { key: 'a', on: true } }), { ok: true, value: { tick: { key: 'a', on: true } } });
  assert.deepEqual(parseTripPatch({ end: {} }), { ok: true, value: { end: { paid: null } } });
  assert.deepEqual(parseTripPatch({ end: { paid: 12700 } }), { ok: true, value: { end: { paid: 12700 } } });
  assert.equal(parseTripPatch({ end: { paid: 1.5 } }).ok, false);
  assert.equal(parseTripPatch({}).ok, false);
});

test('taps still in flight win over the server\'s older answer', () => {
  // The reply to tap 1 arrives after tap 2 was sent: it doesn't know about b yet.
  assert.deepEqual(withPending(['a'], new Map([['b', true]])).sort(), ['a', 'b']);
  // An untick in flight hides a tick the server still reports.
  assert.deepEqual(withPending(['a', 'b'], new Map([['a', false]])), ['b']);
  assert.deepEqual(withPending(['a'], new Map()), ['a']);
});
