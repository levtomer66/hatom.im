import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptPlan, canInvite, isDisposable, parseInviteEmail, wrongHousehold } from '../shopping/household.ts';

test('parseInviteEmail trims, lowercases and rejects non-emails', () => {
  assert.deepEqual(parseInviteEmail('  Dana@Example.COM '), { ok: true, value: 'dana@example.com' });
  assert.equal(parseInviteEmail('dana').ok, false);
  assert.equal(parseInviteEmail('da na@x.com').ok, false);
  assert.equal(parseInviteEmail(42).ok, false);
});

test('canInvite refuses a member, a duplicate and the caps', () => {
  const h = { members: ['a@x.com'], invites: [{ email: 'b@x.com', by: 'a@x.com', at: 't' }] };
  assert.equal(canInvite(h, 'a@x.com').ok, false);
  assert.equal(canInvite(h, 'b@x.com').ok, false);
  assert.deepEqual(canInvite(h, 'c@x.com'), { ok: true, value: true });
  const full = { members: Array.from({ length: 10 }, (_, i) => `m${i}@x.com`), invites: [] };
  assert.equal(canInvite(full, 'c@x.com').ok, false);
  const invited = { members: ['a@x.com'], invites: Array.from({ length: 10 }, (_, i) => ({ email: `i${i}@x.com`, by: 'a@x.com', at: 't' })) };
  assert.equal(canInvite(invited, 'c@x.com').ok, false);
});

test('acceptPlan deletes a household its only member leaves, counting what goes', () => {
  const line = { key: '1', name: 'x', qty: 1, w: false };
  assert.deepEqual(acceptPlan({ members: ['a@x.com'], items: [{ ...line, addedBy: '', addedAt: '' }], list: [line] }, 'a@x.com'), { deleteFrom: true, loses: 2 });
  assert.deepEqual(acceptPlan({ members: ['a@x.com', 'b@x.com'], items: [], list: [] }, 'a@x.com'), { deleteFrom: false, loses: 0 });
});

test('wrongHousehold: a save naming another household is stale; an old client that names none is allowed', () => {
  assert.equal(wrongHousehold('old', 'new'), true);
  assert.equal(wrongHousehold('new', 'new'), false);
  assert.equal(wrongHousehold(undefined, 'new'), false);
});

test('isDisposable: only a household with just this person and nothing in it', () => {
  const empty = { members: ['a@x.com'], invites: [], items: [], list: [], favStores: [] };
  assert.equal(isDisposable(empty, 'a@x.com'), true);
  assert.equal(isDisposable({ ...empty, favStores: [1] }, 'a@x.com'), false);
  assert.equal(isDisposable({ ...empty, members: ['a@x.com', 'b@x.com'] }, 'a@x.com'), false);
  assert.equal(isDisposable({ ...empty, list: [{ key: '1', name: 'x', qty: 1, w: false }] }, 'a@x.com'), false);
});
