import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocalDate,
  toYmd,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  monthKey,
  groupByMonthAndWeek,
  weeksAgo,
} from '../workout-weeks.ts';

// 2026-09-03 is a Thursday; its Sun–Sat week is Aug 30 → Sep 5.

test('parseLocalDate reads YYYY-MM-DD as a local calendar day', () => {
  const d = parseLocalDate('2026-09-03');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 3);
  assert.equal(d.getHours(), 0);
  assert.equal(toYmd(d), '2026-09-03');
});

test('startOfWeek is the Sunday on or before the date', () => {
  assert.equal(toYmd(startOfWeek(parseLocalDate('2026-09-03'))), '2026-08-30'); // Thu → Sun
  assert.equal(toYmd(startOfWeek(parseLocalDate('2026-08-30'))), '2026-08-30'); // Sunday stays
  assert.equal(toYmd(startOfWeek(parseLocalDate('2026-09-05'))), '2026-08-30'); // Sat → same week
  assert.equal(toYmd(startOfWeek(parseLocalDate('2026-09-06'))), '2026-09-06'); // next Sunday
});

test('endOfWeek is the following Saturday', () => {
  assert.equal(toYmd(endOfWeek(parseLocalDate('2026-08-30'))), '2026-09-05');
});

test('month bounds', () => {
  assert.equal(toYmd(startOfMonth(parseLocalDate('2026-09-17'))), '2026-09-01');
  assert.equal(toYmd(endOfMonth(parseLocalDate('2026-09-17'))), '2026-09-30');
  assert.equal(toYmd(endOfMonth(parseLocalDate('2026-02-10'))), '2026-02-28');
  assert.equal(monthKey(parseLocalDate('2026-09-03')), '2026-09');
});

test('groupByMonthAndWeek nests weeks under calendar months, newest first, and counts', () => {
  const items = [
    { id: 'a', date: '2026-09-03' }, // Thu, week Aug 30 → Sep
    { id: 'b', date: '2026-08-30' }, // Sun, same week → Aug (calendar month wins)
    { id: 'c', date: '2026-08-29' }, // Sat, week Aug 23 → Aug
    { id: 'd', date: '2026-08-24' }, // Mon, week Aug 23 → Aug
    { id: 'e', date: '2026-08-05' }, // Wed, week Aug 2 → Aug
  ];
  const months = groupByMonthAndWeek(items);

  assert.deepEqual(months.map((m) => m.key), ['2026-09', '2026-08']);
  assert.deepEqual(months.map((m) => m.count), [1, 4]);

  const sep = months[0];
  assert.equal(toYmd(sep.monthStart), '2026-09-01');
  assert.equal(sep.weeks.length, 1);
  assert.equal(sep.weeks[0].key, '2026-08-30');
  assert.deepEqual(sep.weeks[0].items.map((i) => i.id), ['a']);

  const aug = months[1];
  assert.deepEqual(aug.weeks.map((w) => w.key), ['2026-08-30', '2026-08-23', '2026-08-02']);
  assert.deepEqual(aug.weeks[0].items.map((i) => i.id), ['b']);
  assert.deepEqual(aug.weeks[1].items.map((i) => i.id), ['c', 'd']);
  assert.deepEqual(aug.weeks[2].items.map((i) => i.id), ['e']);
});

test('a straddling week is clipped to each month and marked partial', () => {
  const months = groupByMonthAndWeek([
    { id: 'a', date: '2026-09-03' },
    { id: 'b', date: '2026-08-30' },
  ]);
  const sepWeek = months[0].weeks[0];
  assert.equal(toYmd(sepWeek.start), '2026-08-30');      // the real week
  assert.equal(toYmd(sepWeek.end), '2026-09-05');
  assert.equal(toYmd(sepWeek.rangeStart), '2026-09-01'); // what September shows
  assert.equal(toYmd(sepWeek.rangeEnd), '2026-09-05');
  assert.equal(sepWeek.partial, true);

  const augWeek = months[1].weeks[0];
  assert.equal(toYmd(augWeek.rangeStart), '2026-08-30'); // what August shows
  assert.equal(toYmd(augWeek.rangeEnd), '2026-08-31');
  assert.equal(augWeek.partial, true);
});

test('a week fully inside a month is not partial and shows its full range', () => {
  const [aug] = groupByMonthAndWeek([{ id: 'c', date: '2026-08-29' }]);
  const week = aug.weeks[0];
  assert.equal(toYmd(week.rangeStart), '2026-08-23');
  assert.equal(toYmd(week.rangeEnd), '2026-08-29');
  assert.equal(week.partial, false);
});

test('New Year week is split between December and January', () => {
  const months = groupByMonthAndWeek([
    { id: 'jan1', date: '2026-01-01' },
    { id: 'dec29', date: '2025-12-29' },
  ]);
  assert.deepEqual(months.map((m) => m.key), ['2026-01', '2025-12']);
  assert.equal(months[0].weeks[0].key, '2025-12-28');
  assert.equal(toYmd(months[0].weeks[0].rangeStart), '2026-01-01');
  assert.equal(toYmd(months[0].weeks[0].rangeEnd), '2026-01-03');
  assert.equal(months[1].weeks[0].key, '2025-12-28');
  assert.equal(toYmd(months[1].weeks[0].rangeStart), '2025-12-28');
  assert.equal(toYmd(months[1].weeks[0].rangeEnd), '2025-12-31');
});

test('groupByMonthAndWeek handles an empty list', () => {
  assert.deepEqual(groupByMonthAndWeek([]), []);
});

test('weeksAgo: 0 for this week, 1 for last week', () => {
  const today = parseLocalDate('2026-09-03');
  assert.equal(weeksAgo(parseLocalDate('2026-08-30'), today), 0);
  assert.equal(weeksAgo(parseLocalDate('2026-08-23'), today), 1);
  assert.equal(weeksAgo(parseLocalDate('2026-08-02'), today), 4);
});
