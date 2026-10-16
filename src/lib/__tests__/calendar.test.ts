import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEED_EVENTS,
  countdownLabel,
  daysBetween,
  eventsInMonth,
  milestoneLabel,
  monthGrid,
  nextOccurrence,
  parseEventInput,
  parseYmd,
  pastEvents,
  upcoming,
  type CalendarEvent,
  type CalendarEventInput,
} from '../calendar.ts';

const ev = (input: CalendarEventInput, id = input.title): CalendarEvent => ({
  ...input,
  id,
  createdBy: 'test',
  createdAt: '',
  updatedAt: '',
});

const firstDate = ev({ title: 'first date', date: '2020-10-25', kind: 'anniversary' });
const wedding = ev({ title: 'wedding', date: '2026-07-07', kind: 'anniversary' });
const tomer = ev({ title: 'tomer', date: '1994-06-16', kind: 'birthday' });
const leap = ev({ title: 'leap', date: '2000-02-29', kind: 'birthday' });
const party = ev({ title: 'party', date: '2026-12-31', kind: 'event' });
const oldTrip = ev({ title: 'trip', date: '2025-05-01', kind: 'event' });

test('every seed event is valid input', () => {
  for (const seed of SEED_EVENTS) assert.equal(parseEventInput(seed).ok, true, seed.title);
});

test('parseYmd rejects impossible dates', () => {
  assert.deepEqual(parseYmd('2024-02-29'), { y: 2024, m: 2, d: 29 });
  assert.equal(parseYmd('2023-02-29'), null);
  assert.equal(parseYmd('2023-13-01'), null);
  assert.equal(parseYmd('25.10.2020'), null);
});

test('daysBetween counts calendar days across DST', () => {
  assert.equal(daysBetween('2026-03-26', '2026-03-28'), 2);
  assert.equal(daysBetween('2026-10-16', '2026-10-25'), 9);
});

test('a recurring event lands on its next anniversary with the right count', () => {
  const o = nextOccurrence(firstDate, '2026-10-16')!;
  assert.equal(o.date, '2026-10-25');
  assert.equal(o.daysUntil, 9);
  assert.equal(o.years, 6);
  assert.equal(milestoneLabel(o), '6 שנים');

  const w = nextOccurrence(wedding, '2026-10-16')!;
  assert.equal(w.date, '2027-07-07');
  assert.equal(w.years, 1);
  assert.equal(milestoneLabel(w), 'שנה');
});

test('today counts as the occurrence, not next year', () => {
  const o = nextOccurrence(tomer, '2026-06-16')!;
  assert.equal(o.daysUntil, 0);
  assert.equal(o.years, 32);
  assert.equal(milestoneLabel(o), 'גיל 32');
});

test('a future anniversary counts down to the day itself, with no label', () => {
  const o = nextOccurrence(wedding, '2026-01-01')!;
  assert.equal(o.date, '2026-07-07');
  assert.equal(o.years, 0);
  assert.equal(milestoneLabel(o), null);
});

test('Feb 29 birthdays fall on Feb 28 in common years', () => {
  assert.equal(nextOccurrence(leap, '2027-01-10')!.date, '2027-02-28');
  assert.equal(nextOccurrence(leap, '2028-01-10')!.date, '2028-02-29');
});

test('one-off events: upcoming until the day, then past', () => {
  assert.equal(nextOccurrence(party, '2026-10-16')!.years, null);
  assert.equal(nextOccurrence(oldTrip, '2026-10-16'), null);
  assert.deepEqual(pastEvents([party, oldTrip, firstDate], '2026-10-16').map((e) => e.title), ['trip']);
});

test('upcoming is soonest first and skips past one-offs', () => {
  const list = upcoming([wedding, party, oldTrip, firstDate, tomer], '2026-10-16');
  assert.deepEqual(list.map((o) => o.event.title), ['first date', 'party', 'tomer', 'wedding']);
});

test('eventsInMonth shows recurring events only from their first year', () => {
  assert.deepEqual(eventsInMonth([wedding, party], 2026, 7).get(7)?.map((e) => e.title), ['wedding']);
  assert.equal(eventsInMonth([wedding], 2025, 7).size, 0);
  assert.equal(eventsInMonth([party], 2027, 12).size, 0);
  assert.equal(eventsInMonth([leap], 2027, 2).get(28)?.length, 1);
});

test('monthGrid starts on Sunday and pads to full weeks', () => {
  const grid = monthGrid(2026, 10); // Oct 1 2026 is a Thursday
  assert.deepEqual(grid[0], [null, null, null, null, 1, 2, 3]);
  assert.ok(grid.every((row) => row.length === 7));
  assert.equal(grid.flat().filter((d) => d !== null).length, 31);
});

test('countdownLabel', () => {
  assert.equal(countdownLabel(0), 'היום!');
  assert.equal(countdownLabel(1), 'מחר');
  assert.equal(countdownLabel(9), 'עוד 9 ימים');
});

test('parseEventInput validates and trims', () => {
  const ok = parseEventInput({ title: '  מסיבה ', date: '2026-12-31', kind: 'event', emoji: '', note: ' x ' });
  assert.deepEqual(ok, { ok: true, value: { title: 'מסיבה', date: '2026-12-31', kind: 'event', note: 'x' } });
  assert.equal(parseEventInput({ title: '', date: '2026-12-31', kind: 'event' }).ok, false);
  assert.equal(parseEventInput({ title: 'a', date: '2026-02-30', kind: 'event' }).ok, false);
  assert.equal(parseEventInput({ title: 'a', date: '2026-01-01', kind: 'holiday' }).ok, false);
  assert.equal(parseEventInput({ title: 'a'.repeat(81), date: '2026-01-01', kind: 'event' }).ok, false);
  assert.equal(parseEventInput(null).ok, false);
});
