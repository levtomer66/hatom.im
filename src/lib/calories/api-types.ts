// Shapes the /api/calories routes return. Import-free (types only).

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
  /** The weight shared with the workout app, and the last 60 days' weigh-ins. */
  weight: { kg: number | null; log: WeighIn[] };
  /** The recommendation from the profile and the shared weight; null without them. */
  rec: { goal: number; proteinGoal: number } | null;
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
  units: Unit[];
  source: 'moh' | 'off' | 'manual' | 'meal';
  maker?: string;
}

export interface SearchResponse { meals: FoodHit[]; foods: FoodHit[]; products: FoodHit[] }

export type ProductResponse = FoodHit & { key: string; w: boolean; liquid: boolean };

export interface MealsResponse { meals: MealDoc[] }
