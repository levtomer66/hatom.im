// Shapes the /api/calories routes return. Import-free (types only).

import type { Nutrition } from '../shopping/nutrition.ts';
import type { Entry, MealDoc, Recent, Ref, Settings, Totals, Unit, WeighIn } from './calories.ts';

export interface WeekBar { date: string; kcal: number; over: boolean }

export interface DayResponse {
  date: string;
  entries: Entry[];
  settings: Settings | null;
  week: WeekBar[];
  recent: Recent[];
  /** That day's finished workouts with their burn (corrected or estimated). */
  burned: BurnedRow[];
  /** That day's steps typed by hand and their burn (stepsBurn); null when none were typed. */
  steps: StepsRow | null;
  /** The weight shared with the workout app, and the last 60 days' weigh-ins. */
  weight: { kg: number | null; log: WeighIn[] };
  /** The recommendation from the profile and the shared weight; null without them. */
  rec: { goal: number; proteinGoal: number } | null;
  /** The caller is a pregnant owner (docs/superpowers/specs/2026-11-24-pregnancy-design.md): her day of pregnancy and the goal's extra. */
  preg: { day: number; extra: number; trimester: 1 | 2 | 3 } | null;
}

export interface StepsRow {
  n: number;
  kcal: number;
  /** The steps the profile's activity level already counts (not burned again). */
  base: number;
  assumedKg: boolean;
}

export interface BurnedRow {
  id: string;
  name: string;
  kcal: number;
  /** true while no one has corrected the estimate. */
  est: boolean;
  estKcal: number;
  sets: number;
  /** The estimate used 70 kg (no weight yet). */
  assumedKg: boolean;
}

/** One food to log: a product, an MoH food or a home-made meal. */
export interface FoodHit {
  ref: Ref;
  name: string;
  img: string | null;
  /** Per 100 g (ml); null when nobody has typed the label yet. Meals: null, see `per`. */
  per100: Totals | null;
  /** A home-made meal: one portion. */
  per?: Totals;
  /** The full label per 100 g (ml) — sugars, fibre, sodium… — for the product view; products and MoH foods. */
  label?: Nutrition;
  units: Unit[];
  source: 'moh' | 'off' | 'manual' | 'meal' | 'recipe' | 'drink';
  /** A built-in drink's caffeine per unit, mg. */
  caf?: number;
  maker?: string;
}

export interface SearchResponse { meals: FoodHit[]; foods: FoodHit[]; products: FoodHit[]; drinks?: FoodHit[] }

export type ProductResponse = FoodHit & { key: string; w: boolean; liquid: boolean };

export interface MealsResponse { meals: MealDoc[] }
