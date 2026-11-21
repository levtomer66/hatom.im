// The calories diary's rules (docs/superpowers/specs/2026-11-21-calories-design.md):
// entry totals, home-made meals, a day's and a week's sums, units, and the
// checks every write goes through. Import-free apart from shopping's own
// import-free nutrition module, for `node --test`.

import { plausible, type Nutrition } from '../shopping/nutrition.ts';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_NAMES: Record<Meal, string> = { breakfast: 'בוקר', lunch: 'צהריים', dinner: 'ערב', snack: 'נשנושים' };

/** kcal and grams of protein, carbohydrates and fat. */
export interface Totals { kcal: number; p: number; c: number; f: number }
export interface Ref { kind: 'product' | 'food' | 'meal' | 'quick'; key: string | null }
/** A unit of measure and its weight in grams ("יחידה בינונית", 50). A quick entry's is 0. */
export interface Unit { name: string; g: number }

export interface Entry {
  id: string;
  meal: Meal;
  name: string;
  img: string | null;
  ref: Ref;
  unit: Unit;
  qty: number;
  /** This entry's totals, frozen when it was logged. */
  nu: Totals;
  at: string;
}

/** A food logged lately, with its last amount, for one-tap logging. */
export interface Recent {
  ref: Ref;
  name: string;
  img: string | null;
  unit: Unit;
  qty: number;
  /** Per 100 g; null for quick entries and meals. */
  per100: Totals | null;
  /** A home-made meal's or a quick entry's totals for one unit. */
  per?: Totals;
}

export interface Settings { goal: number; proteinGoal: number | null }

export interface MealItem { ref: Ref; name: string; grams: number; nu: Totals }
export interface MealDoc { id: string; name: string; portions: number; items: MealItem[]; per: Totals }

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const DEFAULT_GOAL = 2000;
export const MAX_ENTRIES = 60;
export const MAX_GRAMS = 5000;
export const MAX_RECENT = 15;
export const MAX_MEAL_ITEMS = 40;
export const MAX_NAME = 80;
export const MAX_PORTIONS = 20;

const r0 = (v: number) => Math.round(v);
const r1 = (v: number) => Math.round(v * 10) / 10;
const ZERO: Totals = { kcal: 0, p: 0, c: 0, f: 0 };

export function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export const scaleTotals = (t: Totals, factor: number): Totals =>
  ({ kcal: r0(t.kcal * factor), p: r1(t.p * factor), c: r1(t.c * factor), f: r1(t.f * factor) });

export const entryTotals = (per100: Totals, grams: number): Totals => scaleTotals(per100, grams / 100);

export const sumTotals = (list: Totals[]): Totals =>
  scaleTotals(list.reduce((a, t) => ({ kcal: a.kcal + t.kcal, p: a.p + t.p, c: a.c + t.c, f: a.f + t.f }), ZERO), 1);

export const rescaleEntry = (e: Entry, qty: number): Entry => ({ ...e, qty, nu: scaleTotals(e.nu, qty / e.qty) });

export const mealPerPortion = (items: MealItem[], portions: number): Totals =>
  scaleTotals(sumTotals(items.map((i) => i.nu)), 1 / portions);

export function mealTotals(entries: Entry[]): Record<Meal, Totals> {
  const out = Object.fromEntries(MEALS.map((m) => [m, ZERO])) as Record<Meal, Totals>;
  for (const m of MEALS) out[m] = sumTotals(entries.filter((e) => e.meal === m).map((e) => e.nu));
  return out;
}

/** The 7 dates ending on `endDate`, oldest first. */
export function weekDates(endDate: string): string[] {
  const [y, m, d] = endDate.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d - 6 + i)).toISOString().slice(0, 10));
}

export const weekBars = (days: Record<string, Totals>, endDate: string, goal: number) =>
  weekDates(endDate).map((date) => {
    const kcal = days[date]?.kcal ?? 0;
    return { date, kcal, over: kcal > goal };
  });

/** By the device's hour; the small hours (before 4) count as a snack. */
export function defaultMeal(hour: number): Meal {
  if (hour < 4 || hour >= 21) return 'snack';
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner';
}

/** The unit chips for a food: grams (ml for drinks) first, then the pack, then its own portions. */
export function unitsFor(o: { units?: Unit[]; pack?: number | null; w?: boolean; liquid?: boolean }): Unit[] {
  const out: Unit[] = [{ name: o.liquid ? 'מ״ל' : 'גרם', g: 1 }];
  if (o.pack && o.pack > 0 && !o.w) out.push({ name: 'אריזה', g: o.pack });
  for (const u of o.units ?? []) if (u.g > 0 && !out.some((x) => x.name === u.name)) out.push(u);
  return out;
}

export function toTotals(nu: Nutrition | null): Totals | null {
  if (!nu || nu.kcal === null) return null;
  return { kcal: nu.kcal, p: nu.p ?? 0, c: nu.c ?? 0, f: nu.f ?? 0 };
}

// ── checks ──

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const cleanName = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s && s.length <= MAX_NAME ? s : null;
};

export function parseTotals(v: unknown): Totals | null {
  if (!isObj(v) || ![v.kcal, v.p, v.c, v.f].every(isNum)) return null;
  const t = { kcal: v.kcal as number, p: v.p as number, c: v.c as number, f: v.f as number };
  return t.kcal <= 20_000 && t.p <= 2000 && t.c <= 2000 && t.f <= 2000 ? scaleTotals(t, 1) : null;
}

function parseRef(v: unknown): Ref | null {
  if (!isObj(v) || !['product', 'food', 'meal', 'quick'].includes(v.kind as string)) return null;
  const kind = v.kind as Ref['kind'];
  if (kind === 'quick') return { kind, key: null };
  return typeof v.key === 'string' && v.key.length > 0 && v.key.length <= 60 ? { kind, key: v.key } : null;
}

export function parseEntry(v: unknown): Result<Omit<Entry, 'id' | 'at'>> {
  if (!isObj(v)) return fail('רישום לא תקין');
  if (!MEALS.includes(v.meal as Meal)) return fail('ארוחה לא מוכרת');
  const name = cleanName(v.name);
  if (!name) return fail(`שם של עד ${MAX_NAME} תווים`);
  const ref = parseRef(v.ref);
  if (!ref) return fail('מקור לא תקין');
  const unit = isObj(v.unit) ? { name: cleanName(v.unit.name), g: v.unit.g } : null;
  if (!unit?.name || !isNum(unit.g)) return fail('יחידה לא תקינה');
  if (!isNum(v.qty) || v.qty <= 0) return fail('כמות לא תקינה');
  if (ref.kind !== 'quick' && unit.g <= 0) return fail('יחידה לא תקינה');
  if (unit.g * v.qty > MAX_GRAMS) return fail(`עד ${MAX_GRAMS.toLocaleString('he-IL')} גרם ברישום אחד`);
  const nu = parseTotals(v.nu);
  if (!nu) return fail('ערכים לא תקינים');
  const img = typeof v.img === 'string' && v.img.length <= 500 && /^https?:\/\//.test(v.img) ? v.img : null;
  return { ok: true, value: { meal: v.meal as Meal, name, img, ref, unit: { name: unit.name, g: unit.g }, qty: v.qty, nu } };
}

export function parseSettings(v: unknown): Result<Settings> {
  if (!isObj(v)) return fail('הגדרות לא תקינות');
  const goal = v.goal;
  if (typeof goal !== 'number' || !Number.isInteger(goal) || goal < 500 || goal > 10_000) return fail('יעד בין 500 ל־10,000 קק״ל');
  const pg = v.proteinGoal ?? null;
  if (pg !== null && (typeof pg !== 'number' || !Number.isFinite(pg) || pg < 10 || pg > 500)) return fail('יעד חלבון בין 10 ל־500 גרם');
  return { ok: true, value: { goal, proteinGoal: pg === null ? null : Math.round(pg) } };
}

/** Values typed from a package, per 100 g: kcal required, the rest optional. */
export function parseLabel(v: unknown): Result<Nutrition> {
  if (!isObj(v)) return fail('ערכים לא תקינים');
  const opt = (x: unknown) => (x === undefined || x === null || x === '' ? null : isNum(x) ? x : NaN);
  const nu: Nutrition = { kcal: opt(v.kcal), p: opt(v.p), c: opt(v.c), s: opt(v.s), f: opt(v.f), sf: opt(v.sf), fib: opt(v.fib), na: opt(v.na), by: 'manual' };
  if ([nu.kcal, nu.p, nu.c, nu.s, nu.f, nu.sf, nu.fib, nu.na].some((x) => Number.isNaN(x))) return fail('ערכים לא תקינים');
  if (nu.kcal === null) return fail('צריך לפחות קלוריות');
  const why = plausible(nu);
  return why ? fail('הערכים לא נראים נכונים — כדאי לבדוק שוב את האריזה') : { ok: true, value: nu };
}

export function parseMeal(v: unknown): Result<{ name: string; portions: number; items: MealItem[] }> {
  if (!isObj(v)) return fail('ארוחה לא תקינה');
  const name = cleanName(v.name);
  if (!name) return fail(`שם של עד ${MAX_NAME} תווים`);
  const portions = v.portions;
  if (typeof portions !== 'number' || !Number.isInteger(portions) || portions < 1 || portions > MAX_PORTIONS) return fail(`בין 1 ל־${MAX_PORTIONS} מנות`);
  if (!Array.isArray(v.items) || !v.items.length || v.items.length > MAX_MEAL_ITEMS) return fail(`בין 1 ל־${MAX_MEAL_ITEMS} מרכיבים`);
  const items: MealItem[] = [];
  for (const it of v.items) {
    if (!isObj(it)) return fail('מרכיב לא תקין');
    const ref = parseRef(it.ref);
    const iname = cleanName(it.name);
    const nu = parseTotals(it.nu);
    if (!ref || ref.kind === 'meal' || !iname || !nu || !isNum(it.grams) || it.grams <= 0 || it.grams > MAX_GRAMS) return fail('מרכיב לא תקין');
    items.push({ ref, name: iname, grams: it.grams, nu });
  }
  return { ok: true, value: { name, portions, items } };
}

/** Newest first, one per food (quick entries by name), at most MAX_RECENT. */
export function pushRecent(recent: Recent[], r: Recent): Recent[] {
  const same = (x: Recent) => (r.ref.kind === 'quick' ? x.ref.kind === 'quick' && x.name === r.name : x.ref.kind === r.ref.kind && x.ref.key === r.ref.key);
  return [r, ...recent.filter((x) => !same(x))].slice(0, MAX_RECENT);
}
