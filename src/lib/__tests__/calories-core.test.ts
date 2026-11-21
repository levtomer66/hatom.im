import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultMeal, entryTotals, isDate, mealPerPortion, mealTotals, parseEntry, parseLabel, parseMeal, parseSettings, pushRecent, rescaleEntry,
  sumTotals, toTotals, unitsFor, weekBars, weekDates, type Entry, type Recent,
} from '../calories/calories.ts';

const entry = (o: Partial<Entry> = {}): Entry => ({
  id: 'a', meal: 'lunch', name: 'x', img: null, ref: { kind: 'food', key: '1' }, unit: { name: 'גרם', g: 1 }, qty: 100,
  nu: { kcal: 200, p: 10, c: 0, f: 5 }, at: '', ...o,
});

test('entryTotals rounds kcal to 1 and grams to 0.1', () => {
  assert.deepEqual(entryTotals({ kcal: 534, p: 17.5, c: 40, f: 35 }, 25), { kcal: 134, p: 4.4, c: 10, f: 8.8 });
});

test('rescaleEntry scales the frozen totals', () => {
  const e = rescaleEntry(entry(), 200);
  assert.equal(e.qty, 200);
  assert.deepEqual(e.nu, { kcal: 400, p: 20, c: 0, f: 10 });
});

test('sumTotals and mealTotals', () => {
  assert.deepEqual(sumTotals([{ kcal: 1, p: 0.1, c: 0.2, f: 0 }, { kcal: 2, p: 0.2, c: 0, f: 0 }]), { kcal: 3, p: 0.3, c: 0.2, f: 0 });
  const m = mealTotals([entry(), entry({ meal: 'snack' }), entry()]);
  assert.equal(m.lunch.kcal, 400);
  assert.equal(m.snack.kcal, 200);
  assert.equal(m.breakfast.kcal, 0);
});

test('mealPerPortion divides the ingredient totals', () => {
  assert.deepEqual(mealPerPortion([{ ref: { kind: 'food', key: '1' }, name: 'a', grams: 300, nu: { kcal: 600, p: 30, c: 60, f: 21 } }], 3), { kcal: 200, p: 10, c: 20, f: 7 });
});

test('weekDates crosses a year', () => {
  assert.deepEqual(weekDates('2027-01-02'), ['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
});

test('weekBars marks days over the goal, missing days are 0', () => {
  const bars = weekBars({ '2026-11-21': { kcal: 2100, p: 0, c: 0, f: 0 } }, '2026-11-21', 2000);
  assert.equal(bars.length, 7);
  assert.deepEqual(bars[6], { date: '2026-11-21', kcal: 2100, over: true });
  assert.equal(bars[0].kcal, 0);
  assert.equal(bars[0].over, false);
});

test('defaultMeal by hour', () => {
  assert.deepEqual([6, 10, 11, 15, 16, 20, 21, 2].map(defaultMeal), ['breakfast', 'breakfast', 'lunch', 'lunch', 'dinner', 'dinner', 'snack', 'snack']);
});

test('unitsFor: grams first; pack only when known and not weighed; ml for liquids', () => {
  assert.deepEqual(unitsFor({ pack: 200 }), [{ name: 'גרם', g: 1 }, { name: 'אריזה', g: 200 }]);
  assert.deepEqual(unitsFor({ pack: 1000, w: true }), [{ name: 'גרם', g: 1 }]);
  assert.deepEqual(unitsFor({ pack: null }), [{ name: 'גרם', g: 1 }]);
  assert.deepEqual(unitsFor({ liquid: true, pack: 330 }), [{ name: 'מ״ל', g: 1 }, { name: 'אריזה', g: 330 }]);
  assert.deepEqual(unitsFor({ units: [{ name: 'יחידה בינונית', g: 50 }] }), [{ name: 'גרם', g: 1 }, { name: 'יחידה בינונית', g: 50 }]);
});

test('isDate', () => {
  assert.ok(isDate('2026-02-28'));
  assert.ok(!isDate('2026-02-30'));
  assert.ok(!isDate('2026-2-3'));
  assert.ok(!isDate(5));
});

test('toTotals: null without kcal, missing macros are 0', () => {
  const nu = { kcal: 100, p: 5, c: null, s: null, f: 2, sf: null, fib: null, na: null, by: 'off' as const };
  assert.deepEqual(toTotals(nu), { kcal: 100, p: 5, c: 0, f: 2 });
  assert.equal(toTotals({ ...nu, kcal: null }), null);
  assert.equal(toTotals(null), null);
});

test('parseEntry rejects too many grams, bad meal, long name, negative numbers', () => {
  const ok = { meal: 'lunch', name: 'ביצה', img: null, ref: { kind: 'food', key: '123' }, unit: { name: 'יחידה', g: 50 }, qty: 2, nu: { kcal: 140, p: 12, c: 1, f: 10 } };
  assert.equal(parseEntry(ok).ok, true);
  assert.equal(parseEntry({ ...ok, qty: 101 }).ok, false); // 5,050 g
  assert.equal(parseEntry({ ...ok, meal: 'brunch' }).ok, false);
  assert.equal(parseEntry({ ...ok, name: 'א'.repeat(81) }).ok, false);
  assert.equal(parseEntry({ ...ok, nu: { ...ok.nu, kcal: -1 } }).ok, false);
  assert.equal(parseEntry({ ...ok, qty: 0 }).ok, false);
  assert.equal(parseEntry({ ...ok, ref: { kind: 'quick', key: null }, unit: { name: 'מנה', g: 0 }, qty: 1 }).ok, true);
});

test('parseSettings bounds', () => {
  assert.deepEqual(parseSettings({ goal: 1800, proteinGoal: null }), { ok: true, value: { goal: 1800, proteinGoal: null } });
  assert.equal(parseSettings({ goal: 100 }).ok, false);
  assert.equal(parseSettings({ goal: 2000, proteinGoal: 5 }).ok, false);
  assert.deepEqual(parseSettings({ goal: 2000, proteinGoal: 120 }), { ok: true, value: { goal: 2000, proteinGoal: 120 } });
});

test('parseLabel runs plausible and needs kcal', () => {
  const r = parseLabel({ kcal: 250, p: 10, c: 30, f: 10 });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.value.by, 'manual');
  assert.equal(parseLabel({ kcal: 2000 }).ok, false);
  assert.equal(parseLabel({ p: 10 }).ok, false);
});

test('parseMeal: name, 1–20 portions, ingredients ≤ 40', () => {
  const item = { ref: { kind: 'food', key: '1' }, name: 'ביצה', grams: 100, nu: { kcal: 140, p: 12, c: 1, f: 10 } };
  assert.equal(parseMeal({ name: 'שקשוקה', portions: 4, items: [item] }).ok, true);
  assert.equal(parseMeal({ name: '', portions: 4, items: [item] }).ok, false);
  assert.equal(parseMeal({ name: 'x', portions: 0, items: [item] }).ok, false);
  assert.equal(parseMeal({ name: 'x', portions: 2, items: Array(41).fill(item) }).ok, false);
});

test('pushRecent dedupes by ref, newest first, max 15', () => {
  const r = (k: string): Recent => ({ ref: { kind: 'food', key: k }, name: k, img: null, unit: { name: 'גרם', g: 1 }, qty: 100, per100: null });
  let list: Recent[] = [];
  for (let i = 0; i < 20; i++) list = pushRecent(list, r(String(i)));
  assert.equal(list.length, 15);
  assert.equal(list[0].name, '19');
  assert.deepEqual(pushRecent(list, r('10')).map((x) => x.name).slice(0, 2), ['10', '19']);
  assert.equal(pushRecent(list, r('10')).length, 15);
});
