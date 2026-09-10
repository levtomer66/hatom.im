import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd, resolveDueToken } from '../todo-quickadd.ts';
import type { TodoMember } from '../../types/todo.ts';

const MEMBERS: TodoMember[] = [
  { email: 'tomzari347@gmail.com', name: 'Tom' },
  { email: 'levtomer66@gmail.com', name: 'Tomer' },
  { email: 'amitz2002@gmail.com', name: 'Amit' },
];
// A Wednesday.
const WED = new Date(2026, 8, 9); // 2026-09-09

test('plain text passes through untouched', () => {
  const r = parseQuickAdd('Buy milk and eggs', MEMBERS, WED);
  assert.equal(r.text, 'Buy milk and eggs');
  assert.deepEqual(r.assignees, []);
  assert.equal(r.dueDate, undefined);
});

test('@name matches a member by unique name prefix and strips the token', () => {
  const r = parseQuickAdd('Buy milk @amit', MEMBERS, WED);
  assert.equal(r.text, 'Buy milk');
  assert.deepEqual(r.assignees, ['amitz2002@gmail.com']);
});

test('@ ambiguous prefix (tom → Tom & Tomer) stays literal', () => {
  const r = parseQuickAdd('Call @tom', MEMBERS, WED);
  assert.equal(r.text, 'Call @tom');
  assert.deepEqual(r.assignees, []);
});

test('@ unknown stays literal', () => {
  const r = parseQuickAdd('Ping @nobody', MEMBERS, WED);
  assert.equal(r.text, 'Ping @nobody');
  assert.deepEqual(r.assignees, []);
});

test('@ matches by email local-part', () => {
  const r = parseQuickAdd('x @amitz2002', MEMBERS, WED);
  assert.deepEqual(r.assignees, ['amitz2002@gmail.com']);
});

test('!today / !tomorrow / weekday / iso resolve; last valid due wins', () => {
  assert.equal(resolveDueToken('today', WED), '2026-09-09');
  assert.equal(resolveDueToken('tomorrow', WED), '2026-09-10');
  assert.equal(resolveDueToken('friday', WED), '2026-09-11'); // next Fri
  assert.equal(resolveDueToken('wed', WED), '2026-09-09');    // same-day = today
  assert.equal(resolveDueToken('2026-12-25', WED), '2026-12-25');
  assert.equal(resolveDueToken('2026-13-40', WED), null);     // invalid calendar date
  assert.equal(resolveDueToken('someday', WED), null);
  const r = parseQuickAdd('Pay rent !today !2026-10-01', MEMBERS, WED);
  assert.equal(r.text, 'Pay rent');
  assert.equal(r.dueDate, '2026-10-01');
});

test('invalid !token stays literal text', () => {
  const r = parseQuickAdd('Read !later', MEMBERS, WED);
  assert.equal(r.text, 'Read !later');
  assert.equal(r.dueDate, undefined);
});

test('duplicate @assignee is de-duplicated', () => {
  const r = parseQuickAdd('x @amit @amit', MEMBERS, WED);
  assert.deepEqual(r.assignees, ['amitz2002@gmail.com']);
});
