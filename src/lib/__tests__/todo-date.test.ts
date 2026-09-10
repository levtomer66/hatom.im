import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOverdue, formatDueLabel, todayYmd } from '../todo-date.ts';

const WED = new Date(2026, 8, 9); // 2026-09-09, a Wednesday

test('todayYmd formats local date', () => {
  assert.equal(todayYmd(WED), '2026-09-09');
});

test('isOverdue: yesterday overdue, today not, tomorrow not, undated not', () => {
  assert.equal(isOverdue('2026-09-08', WED), true);
  assert.equal(isOverdue('2026-09-09', WED), false);
  assert.equal(isOverdue('2026-09-10', WED), false);
  assert.equal(isOverdue(undefined, WED), false);
});

test('formatDueLabel: today/tomorrow/yesterday/weekday/far', () => {
  assert.equal(formatDueLabel('2026-09-09', WED), 'Today');
  assert.equal(formatDueLabel('2026-09-10', WED), 'Tomorrow');
  assert.equal(formatDueLabel('2026-09-08', WED), 'Yesterday');
  assert.equal(formatDueLabel('2026-09-11', WED), 'Fri');   // within a week
  assert.equal(formatDueLabel('2026-12-25', WED), 'Dec 25');
  assert.equal(formatDueLabel('2027-01-02', WED), 'Jan 2 2027');
});
