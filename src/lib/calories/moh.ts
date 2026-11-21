// The Ministry of Health national nutrition table (צמרת) as `caloriesFoods`
// docs: generic foods (an egg, a slice of bread) with their portion weights.
// Rows come from the data.gov.il datastore API (moh-cli.ts fetches them).
// Credit wherever a value is shown: "מקור: משרד הבריאות, מאגר התזונה הלאומי (data.gov.il)".
// Import-free apart from shopping's import-free nutrition module, for `node --test`.

import { plausible, type Nutrition } from '../shopping/nutrition.ts';
import type { Unit } from './calories.ts';

export const MOH_RESOURCES = {
  foods: 'c3cb0630-0650-46c1-a068-82d575c094b2',
  measures: '98fb46fe-e8de-4067-94d2-b0a8ea4269da',
  unitWeights: '755d28c0-75f7-40e1-9c8c-ecdd106f9b2d',
} as const;

export type Row = Record<string, unknown>;

export interface FoodDoc {
  _id: number;
  n: string;
  nu: Nutrition;
  units: Unit[];
  /** Content hash: a doc is rewritten only when it changes. */
  h: string;
}

/** 1 = generic foods, 2 = manufacturer, 3 = manufacturer label. 4 (home recipes) and null (FFQ survey groups) are left out. */
const KEPT_MAKOR = new Set([1, 2, 3]);
/** גרמים and קילוגרם: the gram chip already covers them. */
const SKIPPED_MEASURES = new Set(['700', '2000']);

const clean = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ');
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round = (v: number | null, digits: number) => (v === null ? null : Math.round(v * 10 ** digits) / 10 ** digits);

/** FNV-1a over the doc's JSON. */
export function contentHash(doc: Omit<FoodDoc, 'h'>): string {
  const s = JSON.stringify(doc);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function buildFoodDocs(foods: Row[], measures: Row[], weights: Row[]): FoodDoc[] {
  const measureName = new Map(measures.map((m) => [clean(m.smlmida), clean(m.shmmida)]));
  const unitsByFood = new Map<number, Unit[]>();
  for (const w of weights) {
    const mida = clean(w.mida);
    const g = num(w.mishkal);
    const name = measureName.get(mida);
    const code = num(w.mmitzrach);
    if (SKIPPED_MEASURES.has(mida) || !name || code === null || g === null || g <= 0) continue;
    const list = unitsByFood.get(code) ?? [];
    if (!list.some((u) => u.name === name)) list.push({ name, g });
    unitsByFood.set(code, list);
  }

  const out: FoodDoc[] = [];
  for (const r of foods) {
    const code = num(r.Code);
    const makor = num(r.makor);
    const n = clean(r.shmmitzrach);
    if (code === null || makor === null || !KEPT_MAKOR.has(makor) || !n) continue;
    const nu: Nutrition = {
      kcal: round(num(r.food_energy), 0),
      p: round(num(r.protein), 1),
      c: round(num(r.carbohydrates), 1),
      s: round(num(r.total_sugars), 1),
      f: round(num(r.total_fat), 1),
      sf: round(num(r.saturated_fat), 1),
      fib: round(num(r.total_dietary_fiber), 1),
      na: round(num(r.sodium), 0),
      by: 'moh',
    };
    if (nu.kcal === null || plausible(nu)) continue;
    const units = (unitsByFood.get(code) ?? []).sort((a, b) => a.g - b.g);
    const doc = { _id: code, n, nu, units };
    out.push({ ...doc, h: contentHash(doc) });
  }
  return out;
}
