import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dateOfDay } from '../pregnancy/dates.ts';
import { dueOn, markDone, openSuggestions, SUGGESTIONS, todayStrip, weekMarks, type PEvent, type Reminder } from '../pregnancy/schedule.ts';

const EDD = '2027-06-08'; // day 0 = 2026-09-01 (a Tuesday)
const ev = (o: Partial<PEvent>): PEvent => ({ id: 'e1', title: 'תור', date: '2026-11-24', kind: 'custom', remindBefore: true, ...o });
const rem = (o: Partial<Reminder>): Reminder => ({ id: 'r1', text: 'ויטמינים', repeat: 'daily', done: [], ...o });

test('suggestions: booked or dismissed ones are not open; deleting the event reopens it', () => {
  assert.ok(SUGGESTIONS.some((s) => s.id === 'nt' && s.from === 11 && s.to === 13));
  const booked = [ev({ kind: 'nt' })];
  assert.ok(!openSuggestions(booked, []).some((s) => s.id === 'nt'));
  assert.ok(openSuggestions([], []).some((s) => s.id === 'nt'));
  assert.ok(!openSuggestions([], ['nt']).some((s) => s.id === 'nt'));
});

test('dueOn: once, daily, weekdays', () => {
  assert.equal(dueOn(rem({ repeat: 'once', date: '2026-11-24' }), '2026-11-24'), true);
  assert.equal(dueOn(rem({ repeat: 'once', date: '2026-11-24' }), '2026-11-25'), false);
  assert.equal(dueOn(rem({}), '2026-11-28'), true);
  const weekdays = rem({ repeat: 'weekdays', days: [0, 1, 2, 3, 4] });
  assert.equal(dueOn(weekdays, '2026-11-22'), true); // Sunday
  assert.equal(dueOn(weekdays, '2026-11-28'), false); // Saturday
});

test('todayStrip: today\'s events, reminders, tomorrow only with remindBefore, windows opening this week', () => {
  const today = dateOfDay(EDD, 77); // 11+0
  const strip = todayStrip({
    edd: EDD,
    events: [ev({ id: 'a', date: today, time: '09:30' }), ev({ id: 'b', date: addDays(today, 1) }), ev({ id: 'c', date: addDays(today, 1), remindBefore: false })],
    reminders: [rem({})],
    dismissed: [],
  }, today);
  const kinds = strip.map((s) => `${s.kind}:${s.id}`);
  assert.ok(kinds.includes('event:a'));
  assert.ok(kinds.includes('tomorrow:b'));
  assert.ok(!kinds.includes('tomorrow:c'));
  assert.ok(kinds.includes('reminder:r1'));
  assert.ok(kinds.includes('window:nt'));
  assert.deepEqual(kinds.slice(0, 2), ['event:a', 'reminder:r1']);
  // Still open in week 12 (the window runs to 13+6), gone once booked or past it.
  const later = todayStrip({ edd: EDD, events: [], reminders: [], dismissed: [] }, dateOfDay(EDD, 84));
  assert.ok(later.some((s) => s.id === 'nt'));
  const after = todayStrip({ edd: EDD, events: [], reminders: [], dismissed: [] }, dateOfDay(EDD, 98));
  assert.ok(!after.some((s) => s.id === 'nt'));
});

test('markDone toggles and keeps only the last 14 days', () => {
  const r = rem({ done: ['2026-11-01', '2026-11-20'] });
  const on = markDone(r, '2026-11-24', true, '2026-11-24');
  assert.deepEqual(on.done, ['2026-11-20', '2026-11-24']);
  assert.deepEqual(markDone(on, '2026-11-24', false, '2026-11-24').done, ['2026-11-20']);
});

test('weekMarks counts a week\'s events and its open windows', () => {
  const p = { edd: EDD, events: [ev({ date: dateOfDay(EDD, 80) })], reminders: [], dismissed: [] };
  assert.deepEqual(weekMarks(p, 11), { events: 1, windows: openSuggestions([], []).filter((s) => s.from <= 11 && s.to >= 11).length });
  assert.equal(weekMarks(p, 12).events, 0);
});

test('markDone keeps only dates in the last 14 days, a future one included', () => {
  const r = rem({ done: [] });
  assert.deepEqual(markDone(r, '2026-12-30', true, '2026-11-24').done, []);
  assert.deepEqual(markDone(r, '2026-11-01', true, '2026-11-24').done, []);
  assert.deepEqual(markDone(r, '2026-11-11', true, '2026-11-24').done, ['2026-11-11']);
});
