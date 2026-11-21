import { test } from 'node:test';
import * as calories from '../calories/calories.ts';
import assert from 'node:assert/strict';
import {
  defaultMeal, entryTotals, isDate, mealPerPortion, mealTotals, parseEntry, parseLabel, parseMeal, parseSettings, pushRecent, rescaleEntry,
  sumTotals, toTotals, unitsFor, weekBars, weekDates, defaultAmount, rollToday, isCurrentDay, type Entry, type Recent,
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

// ── review fixes ──

test('rescaleEntry scales from the logged amount, so repeated edits lose nothing', () => {
  const logged = entry({ qty: 150, nu: { kcal: 200, p: 3, c: 10, f: 0.4 }, base: { qty: 150, nu: { kcal: 200, p: 3, c: 10, f: 0.4 } } });
  const back = rescaleEntry(rescaleEntry(logged, 10), 150);
  assert.deepEqual(back.nu, { kcal: 200, p: 3, c: 10, f: 0.4 });
  assert.deepEqual(back.base, logged.base);
});

test('rescaleEntry on an entry saved before `base` existed starts from its current values', () => {
  assert.deepEqual(rescaleEntry(entry(), 200).base, { qty: 100, nu: { kcal: 200, p: 10, c: 0, f: 5 } });
});

test('defaultAmount: a medium portion, else a small pack (≤ 250 g), else 100 g; meals one portion', () => {
  const g = { name: 'גרם', g: 1 };
  assert.deepEqual(defaultAmount([g, { name: 'יחידה קטנה', g: 44 }, { name: 'יחידה בינונית', g: 49.5 }], false), { unit: { name: 'יחידה בינונית', g: 49.5 }, qty: 1 });
  assert.deepEqual(defaultAmount([g, { name: 'אריזה', g: 80 }], false), { unit: { name: 'אריזה', g: 80 }, qty: 1 });
  assert.deepEqual(defaultAmount([g, { name: 'אריזה', g: 1000 }], false), { unit: g, qty: 100 });
  assert.deepEqual(defaultAmount([{ name: 'מנה', g: 275 }], true), { unit: { name: 'מנה', g: 275 }, qty: 1 });
  assert.deepEqual(defaultAmount([g, { name: 'כף', g: 5 }, { name: 'ספל', g: 85 }], false), { unit: { name: 'כף', g: 5 }, qty: 1 });
});

test('rollToday: after midnight a page showing the old today moves to the new one; another day stays', () => {
  assert.deepEqual(rollToday({ today: '2026-11-21', date: '2026-11-21' }, '2026-11-22'), { today: '2026-11-22', date: '2026-11-22' });
  assert.deepEqual(rollToday({ today: '2026-11-21', date: '2026-11-18' }, '2026-11-22'), { today: '2026-11-22', date: '2026-11-18' });
  const same = { today: '2026-11-21', date: '2026-11-21' };
  assert.equal(rollToday(same, '2026-11-21'), same);
});

test('isCurrentDay: a response for a day the page has moved away from is dropped', () => {
  assert.equal(isCurrentDay('2026-11-20', '2026-11-19'), false);
  assert.equal(isCurrentDay('2026-11-19', '2026-11-19'), true);
});

// ── v2: recommendation, workouts, weigh-ins (2026-11-21-calories-v2-design.md) ──

import { recommend, workoutBurn, pushWeighIn, kgOk, leftToday, MAX_WEIGH_INS, type Profile } from '../calories/calories.ts';

const man: Profile = { sex: 'm', birthYear: 1990, heightCm: 180, activity: 1.375 };

test('recommend: Mifflin-St Jeor × activity, ± aim, kcal to 50 and protein to 5', () => {
  // BMR 10·80 + 6.25·180 − 5·36 + 5 = 1750; × 1.375 = 2406.25
  assert.deepEqual(recommend(man, 'keep', 80, 2026), { goal: 2400, proteinGoal: 130 });
  assert.deepEqual(recommend(man, 'lose', 80, 2026), { goal: 1900, proteinGoal: 160 });
  assert.deepEqual(recommend(man, 'gain', 80, 2026), { goal: 2700, proteinGoal: 145 });
});

test('recommend: floors at 1,200 (f) / 1,500 (m); null without a profile or a weight', () => {
  const small: Profile = { sex: 'f', birthYear: 1950, heightCm: 150, activity: 1.2 };
  assert.equal(recommend(small, 'lose', 45, 2026)?.goal, 1200);
  assert.equal(recommend({ ...small, sex: 'm' }, 'lose', 45, 2026)?.goal, 1500);
  assert.equal(recommend(undefined, 'keep', 80, 2026), null);
  assert.equal(recommend(man, 'keep', null, 2026), null);
  assert.deepEqual(recommend(man, undefined, 80, 2026), recommend(man, 'keep', 80, 2026));
});

test('workoutBurn: 3 min per counted set at MET 5 × kg, rounded to 5', () => {
  const sets = [...Array(18).fill({ reps: 10, seconds: null }), { reps: null, seconds: null }, { reps: 0, seconds: 0 }];
  assert.deepEqual(workoutBurn(sets, 80), { kcal: 360, sets: 18, assumedKg: false });
  assert.deepEqual(workoutBurn([{ reps: null, seconds: 45 }], null), { kcal: 20, sets: 1, assumedKg: true }); // 5·70·3/60 = 17.5
  assert.deepEqual(workoutBurn([], 80), { kcal: 0, sets: 0, assumedKg: false });
});

test('pushWeighIn: one per day (a later one replaces it), oldest dropped past the cap', () => {
  let log = pushWeighIn([], { d: '2026-11-20', kg: 80 });
  log = pushWeighIn(log, { d: '2026-11-21', kg: 79.6 });
  log = pushWeighIn(log, { d: '2026-11-21', kg: 79.4 });
  assert.deepEqual(log, [{ d: '2026-11-20', kg: 80 }, { d: '2026-11-21', kg: 79.4 }]);
  const full = Array.from({ length: MAX_WEIGH_INS }, (_, i) => ({ d: `d${String(i).padStart(4, '0')}`, kg: 80 }));
  const next = pushWeighIn(full, { d: 'e', kg: 81 });
  assert.equal(next.length, MAX_WEIGH_INS);
  assert.equal(next[0].d, 'd0001');
  assert.deepEqual(next.at(-1), { d: 'e', kg: 81 });
});

test('kgOk: 25–400 kg', () => {
  assert.ok(kgOk(80.4));
  assert.ok(!kgOk(24.9));
  assert.ok(!kgOk(401));
  assert.ok(!kgOk('80'));
});

test('leftToday: goal − eaten + burned', () => {
  assert.equal(leftToday(2000, 1060, 310), 1250);
  assert.equal(leftToday(2000, 2500, 0), -500);
});

test('parseSettings: v1 docs still parse; a profile, aim and followRec are checked', () => {
  assert.deepEqual(parseSettings({ goal: 2000, proteinGoal: null }, 2026), { ok: true, value: { goal: 2000, proteinGoal: null } });
  const full = { goal: 2400, proteinGoal: 130, profile: man, aim: 'keep', followRec: true };
  assert.deepEqual(parseSettings(full, 2026), { ok: true, value: full });
  assert.equal(parseSettings({ ...full, profile: { ...man, activity: 1.3 } }, 2026).ok, false);
  assert.equal(parseSettings({ ...full, profile: { ...man, heightCm: 300 } }, 2026).ok, false);
  assert.equal(parseSettings({ ...full, profile: { ...man, birthYear: 2020 } }, 2026).ok, false);
  assert.equal(parseSettings({ ...full, aim: 'bulk' }, 2026).ok, false);
});

// ── v2 review fixes ──

import { formSettings } from '../calories/calories.ts';

const form = { aim: 'keep' as const, sex: 'm' as const, birthYear: '1990', height: '180', activity: 1.375 as const, follow: true, goal: '2000', protein: '' };

test('formSettings: following the recommendation is kept with a profile even before there is a weight', () => {
  const r = formSettings(form, null, 2026);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.value.followRec, true);
  assert.equal(r.ok && r.value.goal, 2000);
  const noSex = formSettings({ ...form, sex: null }, null, 2026);
  assert.equal(noSex.ok && noSex.value.followRec, false);
});

test('formSettings: uses the recommendation while following, the typed numbers otherwise', () => {
  const rec = { goal: 2400, proteinGoal: 130 };
  const following = formSettings(form, rec, 2026);
  assert.deepEqual(following.ok && [following.value.goal, following.value.proteinGoal], [2400, 130]);
  const typed = formSettings({ ...form, follow: false, goal: '1800', protein: '150' }, rec, 2026);
  assert.deepEqual(typed.ok && [typed.value.goal, typed.value.proteinGoal, typed.value.followRec], [1800, 150, false]);
});

test('formSettings: a bad profile value is refused before anything is sent', () => {
  assert.equal(formSettings({ ...form, height: '17' }, null, 2026).ok, false);
  assert.equal(formSettings({ ...form, birthYear: 'abc' }, null, 2026).ok, false);
  assert.equal(formSettings({ ...form, follow: false, goal: '' }, null, 2026).ok, false);
});

test('macroShare: each macro\'s share of the calories, whole percents; nulls without calories', () => {
  const { macroShare } = calories;
  assert.deepEqual(macroShare({ kcal: 1000, p: 50, c: 100, f: 40 }), { p: 20, c: 40, f: 36 });
  assert.deepEqual(macroShare({ kcal: 0, p: 0, c: 0, f: 0 }), { p: null, c: null, f: null });
});

test('macroGoals: fat 25% of the goal, carbs the rest after protein, rounded to 5 g', () => {
  const { macroGoals } = calories;
  // 2400 kcal, 135 g protein: fat 2400·0.25/9 = 66.7 → 65; carbs (2400 − 540 − 585)/4 = 318.75 → 320.
  assert.deepEqual(macroGoals(2400, 135), { p: 135, c: 320, f: 65 });
  // No protein goal: 20% of the calories is set aside for protein, and no protein bar.
  assert.deepEqual(macroGoals(2000, null), { p: null, c: 275, f: 55 });
  // A protein goal bigger than the calories leaves no carbs, never negative.
  assert.equal(macroGoals(1200, 400).c, 0);
});

test('stepsBurn: 0.0005 kcal per kg per step over the activity level\'s usual steps, rounded to 5', () => {
  const { stepsBurn } = calories;
  // No profile: every step counts. 10,000 × 80 kg × 0.0005 = 400.
  assert.deepEqual(stepsBurn(10_000, 80, undefined), { kcal: 400, base: 0, assumedKg: false });
  // Sedentary (1.2): the first 3,000 are already in the goal. 7,000 × 80 × 0.0005 = 280.
  assert.deepEqual(stepsBurn(10_000, 80, 1.2), { kcal: 280, base: 3000, assumedKg: false });
  // Fewer than the usual: nothing, never negative.
  assert.equal(stepsBurn(4000, 80, 1.55).kcal, 0);
  // No weight: 70 kg. 10,000 × 70 × 0.0005 = 350.
  assert.deepEqual(stepsBurn(10_000, null, undefined), { kcal: 350, base: 0, assumedKg: true });
});

test('stepsOk: whole steps, 0–100,000', () => {
  const { stepsOk } = calories;
  assert.ok(stepsOk(0) && stepsOk(12_345) && stepsOk(100_000));
  assert.ok(!stepsOk(-1) && !stepsOk(100_001) && !stepsOk(1.5) && !stepsOk('9000'));
});
