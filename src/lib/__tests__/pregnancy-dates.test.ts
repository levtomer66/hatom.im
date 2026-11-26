import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, calendarWeek, dateOfDay, dayOfPregnancy, daysBetween, eddFrom, heDate, israelHour, israelToday, trimester, wdText, weekDay,
} from '../pregnancy/dates.ts';

test('eddFrom: each dating method', () => {
  assert.equal(eddFrom('lmp', '2026-09-01'), '2027-06-08');
  assert.equal(eddFrom('transfer5', '2026-09-15'), addDays('2026-09-15', 261));
  assert.equal(eddFrom('transfer3', '2026-09-15'), addDays('2026-09-15', 263));
  assert.equal(eddFrom('us', '2026-11-24', 8, 2), addDays('2026-11-24', 280 - 58));
  assert.equal(eddFrom('edd', '2027-06-08'), '2027-06-08');
});

test('eddFrom: bad input is null', () => {
  assert.equal(eddFrom('lmp', '2026-02-30'), null);
  assert.equal(eddFrom('us', '2026-11-24', 43, 0), null);
  assert.equal(eddFrom('us', '2026-11-24', 8, 7), null);
  assert.equal(eddFrom('us', '2026-11-24'), null);
});

test('day of pregnancy, w+d and its words', () => {
  assert.equal(dayOfPregnancy('2027-06-08', '2027-06-08'), 280);
  assert.equal(dayOfPregnancy('2027-06-08', '2026-09-01'), 0);
  assert.deepEqual(weekDay(87), { w: 12, d: 3 });
  assert.equal(wdText(84), '12 שבועות');
  assert.equal(wdText(85), '12 שבועות ויום');
  assert.equal(wdText(86), '12 שבועות ויומיים');
  assert.equal(wdText(87), '12 שבועות ו־3 ימים');
  assert.equal(wdText(7), 'שבוע אחד');
  assert.equal(wdText(3), '3 ימים');
});

test('trimester boundaries', () => {
  assert.equal(trimester(97), 1);
  assert.equal(trimester(98), 2);
  assert.equal(trimester(195), 2);
  assert.equal(trimester(196), 3);
});

test('calendar weeks run Sunday to Saturday', () => {
  const w = calendarWeek('2026-11-25');
  assert.equal(w.length, 7);
  assert.equal(w[0], '2026-11-22');
  assert.equal(w[6], '2026-11-28');
  assert.equal(calendarWeek('2026-11-22')[0], '2026-11-22');
});

test('dates: shifting, between, Israeli format, Israel time', () => {
  assert.equal(dateOfDay('2027-06-08', 280), '2027-06-08');
  assert.equal(daysBetween('2026-11-24', '2026-12-01'), 7);
  assert.equal(heDate('2027-06-03'), '3.6.2027');
  assert.equal(israelToday(new Date('2026-11-24T22:30:00Z')), '2026-11-25');
  assert.equal(israelHour(new Date('2026-11-24T06:30:00Z')), 8);
});
