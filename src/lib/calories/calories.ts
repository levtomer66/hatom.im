// The calories diary's rules (docs/superpowers/specs/2026-11-21-calories-design.md):
// entry totals, home-made meals, a day's and a week's sums, units, and the
// checks every write goes through. Import-free apart from shopping's own
// import-free nutrition module, for `node --test`.

import { plausible, type Nutrition } from '../shopping/nutrition.ts';
import type { FoodHit } from './api-types.ts';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_NAMES: Record<Meal, string> = { breakfast: 'בוקר', lunch: 'צהריים', dinner: 'ערב', snack: 'נשנושים' };

/** kcal and grams of protein, carbohydrates and fat. */
export interface Totals { kcal: number; p: number; c: number; f: number }
/** `drink`: a built-in drink (src/lib/pregnancy/drinks.ts), keyed by its id. */
export interface Ref { kind: 'product' | 'food' | 'meal' | 'quick' | 'drink'; key: string | null }
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
  /** Caffeine in mg for the logged amount, frozen like `nu`; set by the server (a quick entry's is typed). */
  caf?: number;
  /** The coffee order this entry came from (coffee-order). */
  order?: string;
  /** The amount and totals as first logged: edits scale from these, so rounding never compounds. */
  base?: { qty: number; nu: Totals; caf?: number };
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

export type Sex = 'm' | 'f';
export type Aim = 'lose' | 'keep' | 'gain';
/** Daily life without workouts (they're added back as burned): יושבני, קל, פעיל, פעיל מאוד. */
export const ACTIVITY = [1.2, 1.375, 1.55, 1.725] as const;
export type Activity = (typeof ACTIVITY)[number];
export interface Profile { sex: Sex; birthYear: number; heightCm: number; activity: Activity }

export interface Settings {
  goal: number;
  proteinGoal: number | null;
  profile?: Profile;
  aim?: Aim;
  /** The goals track the recommendation (recomputed from the current weight). */
  followRec?: boolean;
}

/** A dated weight, one per day. */
export interface WeighIn { d: string; kg: number }

export interface MealItem { ref: Ref; name: string; grams: number; nu: Totals; caf?: number }
export interface MealDoc { id: string; name: string; portions: number; items: MealItem[]; per: Totals }

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const DEFAULT_GOAL = 2000;
export const MAX_ENTRIES = 60;
export const MAX_GRAMS = 5000;
export const MAX_RECENT = 15;
export const MAX_MEAL_ITEMS = 40;
export const MAX_NAME = 80;
export const MAX_PORTIONS = 20;
export const MAX_WEIGH_INS = 400;
export const ASSUMED_KG = 70;
export const MAX_BURNED = 3000;

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

/** A new quantity: totals scale from the logged amount (`base`), never from an earlier edit's rounded values. */
export function rescaleEntry(e: Entry, qty: number): Entry {
  const base = e.base ?? { qty: e.qty, nu: e.nu, ...(e.caf !== undefined ? { caf: e.caf } : {}) };
  const next: Entry = { ...e, qty, nu: scaleTotals(base.nu, qty / base.qty), base };
  if (base.caf !== undefined) next.caf = Math.round((base.caf * qty) / base.qty);
  return next;
}

/** A day's caffeine, mg. */
export const dayCaf = (entries: Entry[]): number => entries.reduce((a, e) => a + (e.caf ?? 0), 0);
export const MAX_CAF = 1000;

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

/** A pack this small is one serving (a yogurt, a bag of Bamba); a bigger one opens at 100 g. */
export const SERVING_PACK_MAX = 250;

/**
 * What the amount step starts at: a home-made meal's one portion; else a medium
 * portion (an egg: יחידה בינונית); else a pack of one serving; else the food's
 * first other portion; else 100 g.
 */
export function defaultAmount(units: Unit[], isMeal: boolean): { unit: Unit; qty: number } {
  if (isMeal) return { unit: units[0], qty: 1 };
  const portions = units.filter((u) => u.g !== 1);
  const medium = portions.find((u) => u.name.includes('בינונ'));
  if (medium) return { unit: medium, qty: 1 };
  const pack = portions.find((u) => u.name === 'אריזה');
  if (pack && pack.g <= SERVING_PACK_MAX) return { unit: pack, qty: 1 };
  const other = portions.find((u) => u.name !== 'אריזה');
  if (other) return { unit: other, qty: 1 };
  return { unit: units[0], qty: 100 };
}

/** After midnight: the new local day, and a page that was showing the old "today" moves along with it. */
export function rollToday<T extends { today: string; date: string }>(cur: T, nowToday: string): T {
  if (cur.today === nowToday) return cur;
  return { ...cur, today: nowToday, date: cur.date === cur.today ? nowToday : cur.date };
}

/** Whether a day's response still belongs on screen (the page may have moved to another day meanwhile). */
export const isCurrentDay = (responseDate: string, shownDate: string | null) => responseDate === shownDate;

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
  if (!isObj(v) || !['product', 'food', 'meal', 'quick', 'drink'].includes(v.kind as string)) return null;
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
  // Caffeine is the server's to set, except what a quick entry types.
  let caf: number | undefined;
  if (ref.kind === 'quick' && v.caf !== undefined && v.caf !== null) {
    if (typeof v.caf !== 'number' || !Number.isInteger(v.caf) || v.caf < 0 || v.caf > MAX_CAF) return fail(`קפאין עד ${MAX_CAF} מ״ג`);
    caf = v.caf;
  }
  return { ok: true, value: { meal: v.meal as Meal, name, img, ref, unit: { name: unit.name, g: unit.g }, qty: v.qty, nu, ...(caf !== undefined ? { caf } : {}) } };
}

export function parseSettings(v: unknown, year = new Date().getUTCFullYear()): Result<Settings> {
  if (!isObj(v)) return fail('הגדרות לא תקינות');
  const goal = v.goal;
  if (typeof goal !== 'number' || !Number.isInteger(goal) || goal < 500 || goal > 10_000) return fail('יעד בין 500 ל־10,000 קק״ל');
  const pg = v.proteinGoal ?? null;
  if (pg !== null && (typeof pg !== 'number' || !Number.isFinite(pg) || pg < 10 || pg > 500)) return fail('יעד חלבון בין 10 ל־500 גרם');
  const out: Settings = { goal, proteinGoal: pg === null ? null : Math.round(pg) };
  if (v.profile !== undefined && v.profile !== null) {
    const p = v.profile;
    if (!isObj(p) || (p.sex !== 'm' && p.sex !== 'f')) return fail('פרופיל לא תקין');
    if (typeof p.birthYear !== 'number' || !Number.isInteger(p.birthYear) || p.birthYear < 1920 || p.birthYear > year - 13) return fail('שנת לידה לא תקינה');
    if (typeof p.heightCm !== 'number' || !Number.isFinite(p.heightCm) || p.heightCm < 120 || p.heightCm > 230) return fail('גובה בין 120 ל־230 ס״מ');
    if (!ACTIVITY.includes(p.activity as Activity)) return fail('רמת פעילות לא מוכרת');
    out.profile = { sex: p.sex, birthYear: p.birthYear, heightCm: Math.round(p.heightCm), activity: p.activity as Activity };
  }
  if (v.aim !== undefined && v.aim !== null) {
    if (v.aim !== 'lose' && v.aim !== 'keep' && v.aim !== 'gain') return fail('מטרה לא מוכרת');
    out.aim = v.aim;
  }
  if (v.followRec !== undefined) out.followRec = v.followRec === true;
  return { ok: true, value: out };
}

// ── v2: recommendation, workouts, weight (docs/superpowers/specs/2026-11-21-calories-v2-design.md) ──

const AIM_KCAL: Record<Aim, number> = { lose: -500, keep: 0, gain: 300 };
const AIM_PROTEIN: Record<Aim, number> = { lose: 2.0, keep: 1.6, gain: 1.8 };

/** Mifflin-St Jeor × daily activity ± the aim, + `extra` (pregnancy: by trimester); null without a profile or a weight. */
export function recommend(p: Profile | undefined, aim: Aim | undefined, kg: number | null, year: number, extra = 0): { goal: number; proteinGoal: number } | null {
  if (!p || kg === null || !(kg > 0)) return null;
  const a = aim ?? 'keep';
  const bmr = 10 * kg + 6.25 * p.heightCm - 5 * (year - p.birthYear) + (p.sex === 'm' ? 5 : -161);
  const kcal = Math.max(bmr * p.activity + AIM_KCAL[a], p.sex === 'm' ? 1500 : 1200);
  return { goal: Math.round((kcal + extra) / 50) * 50, proteinGoal: Math.round((kg * AIM_PROTEIN[a]) / 5) * 5 };
}

/** A strength workout's estimate: 3 minutes per set with reps or seconds, at MET 5, rounded to 5 kcal. */
export function workoutBurn(sets: { reps?: number | null; seconds?: number | null }[], kg: number | null): { kcal: number; sets: number; assumedKg: boolean } {
  const counted = sets.filter((x) => (x.reps ?? 0) > 0 || (x.seconds ?? 0) > 0).length;
  const assumedKg = !(kg !== null && kg > 0);
  const w = assumedKg ? ASSUMED_KG : (kg as number);
  return { kcal: Math.round((5 * w * counted * 3) / 60 / 5) * 5, sets: counted, assumedKg };
}

export const MAX_STEPS = 100_000;
/** The steps a day of each activity level already has: the recommendation's activity factor counts them. */
export const USUAL_STEPS: Record<Activity, number> = { 1.2: 3000, 1.375: 5000, 1.55: 8000, 1.725: 11000 };

export const stepsOk = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_STEPS;

/**
 * Walking's burn from a day's steps: about 0.0005 kcal per kg per step (≈ 0.04 at
 * 80 kg), counting only the steps over the profile's usual ones (USUAL_STEPS — the
 * goal already holds those); without a profile every step counts. 70 kg without a weight.
 */
export function stepsBurn(steps: number, kg: number | null, activity: Activity | undefined): { kcal: number; base: number; assumedKg: boolean } {
  const assumedKg = !(kg !== null && kg > 0);
  const w = assumedKg ? ASSUMED_KG : (kg as number);
  const base = activity ? USUAL_STEPS[activity] : 0;
  return { kcal: Math.round((Math.max(0, steps - base) * w * 0.0005) / 5) * 5, base, assumedKg };
}

export const kgOk = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 25 && v <= 400;

/** One weigh-in per day (a later one that day replaces it), oldest first, at most `max`. */
export function pushWeighIn(log: WeighIn[], w: WeighIn, max = MAX_WEIGH_INS): WeighIn[] {
  const next = [...log.filter((x) => x.d !== w.d), w].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return next.slice(-max);
}

/** A home-made meal as something to log: one portion (its grams, for showing). */
export const mealHit = (m: MealDoc): FoodHit => ({
  ref: { kind: 'meal', key: m.id },
  name: m.name,
  img: null,
  per100: null,
  per: m.per,
  units: [{ name: 'מנה', g: Math.round(m.items.reduce((a, i) => a + i.grams, 0) / m.portions) || 1 }],
  source: 'meal',
});

/** What the goal form holds (text fields as typed). */
export interface GoalFields {
  aim: Aim; sex: Sex | null; birthYear: string; height: string; activity: Activity | null;
  follow: boolean; goal: string; protein: string;
}

/**
 * The form → the settings to save, checked like the server does (so nothing is
 * sent, not even the weight, when a field is wrong). While following, the goals
 * are the recommendation; with a profile, following is kept even before there is
 * a weight to recommend from (the server keeps the stored numbers until then).
 */
export function formSettings(f: GoalFields, rec: { goal: number; proteinGoal: number } | null, year: number): Result<Settings> {
  const profile = f.sex && f.activity && f.birthYear.trim() && f.height.trim()
    ? { sex: f.sex, activity: f.activity, birthYear: Number(f.birthYear), heightCm: Number(f.height) }
    : undefined;
  const useRec = f.follow && rec;
  return parseSettings({
    goal: useRec ? rec.goal : Math.round(Number(f.goal) || 0),
    proteinGoal: useRec ? rec.proteinGoal : f.protein.trim() ? Math.round(Number(f.protein)) : null,
    aim: f.aim,
    followRec: f.follow && profile !== undefined,
    ...(profile ? { profile } : {}),
  }, year);
}

export const leftToday = (goal: number, eaten: number, burned: number) => goal - eaten + burned;

/**
 * Daily grams for the day card's bars, from the calorie and protein goals
 * (typed or recommended): fat 25% of the calories, carbs whatever is left after
 * protein and fat (20% set aside for protein when there is no protein goal).
 * Rounded to 5 g; carbs never below 0.
 */
export function macroGoals(goal: number, proteinGoal: number | null): Record<'p' | 'c' | 'f', number | null> {
  const r5 = (v: number) => Math.round(v / 5) * 5;
  const f = r5((goal * 0.25) / 9);
  const pKcal = proteinGoal !== null ? proteinGoal * 4 : goal * 0.2;
  return { p: proteinGoal, c: Math.max(0, r5((goal - pKcal - f * 9) / 4)), f };
}

/** Each macro's share of the calories (4 kcal per g of protein and carbs, 9 of fat), whole percents. */
export function macroShare(t: Totals): Record<'p' | 'c' | 'f', number | null> {
  const of = (g: number, per: number) => (t.kcal > 0 ? Math.round((g * per * 100) / t.kcal) : null);
  return { p: of(t.p, 4), c: of(t.c, 4), f: of(t.f, 9) };
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
