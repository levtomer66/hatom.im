import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocalDate,
  toYmd,
  startOfWeek,
  endOfWeek,
  weekAnchor,
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

test('a straddling week belongs to the month of its Wednesday', () => {
  // Aug 30 – Sep 5: Wednesday is Sep 2 → September.
  assert.equal(monthKey(weekAnchor(parseLocalDate('2026-08-30'))), '2026-09');
  // Aug 23 – Aug 29: Wednesday is Aug 26 → August.
  assert.equal(monthKey(weekAnchor(parseLocalDate('2026-08-23'))), '2026-08');
  // Dec 28 2025 – Jan 3 2026: Wednesday is Dec 31 → December 2025.
  assert.equal(monthKey(weekAnchor(parseLocalDate('2025-12-28'))), '2025-12');
});

test('groupByMonthAndWeek nests weeks under months, newest first, and counts', () => {
  const items = [
    { id: 'a', date: '2026-09-03' }, // Thu, week Aug 30 → Sep
    { id: 'b', date: '2026-08-30' }, // Sun, same week → Sep (not Aug!)
    { id: 'c', date: '2026-08-29' }, // Sat, week Aug 23 → Aug
    { id: 'd', date: '2026-08-24' }, // Mon, week Aug 23 → Aug
    { id: 'e', date: '2026-08-05' }, // Wed, week Aug 2 → Aug
  ];
  const months = groupByMonthAndWeek(items);

  assert.deepEqual(months.map((m) => m.key), ['2026-09', '2026-08']);
  assert.deepEqual(months.map((m) => m.count), [2, 3]);

  const sep = months[0];
  assert.equal(sep.weeks.length, 1);
  assert.equal(sep.weeks[0].key, '2026-08-30');
  assert.deepEqual(sep.weeks[0].items.map((i) => i.id), ['a', 'b']);
  assert.equal(toYmd(sep.anchor), '2026-09-01');

  const aug = months[1];
  assert.deepEqual(aug.weeks.map((w) => w.key), ['2026-08-23', '2026-08-02']);
  assert.deepEqual(aug.weeks[0].items.map((i) => i.id), ['c', 'd']);
  assert.deepEqual(aug.weeks[1].items.map((i) => i.id), ['e']);
});

test('groupByMonthAndWeek puts New Year week entirely in December', () => {
  const months = groupByMonthAndWeek([
    { id: 'jan1', date: '2026-01-01' },
    { id: 'dec29', date: '2025-12-29' },
  ]);
  assert.equal(months.length, 1);
  assert.equal(months[0].key, '2025-12');
  assert.equal(months[0].weeks[0].key, '2025-12-28');
  assert.equal(months[0].count, 2);
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
