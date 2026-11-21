// Shapes the /api/calories routes return. Import-free (types only).

import type { Entry, MealDoc, Recent, Ref, Settings, Totals, Unit } from './calories.ts';

export interface WeekBar { date: string; kcal: number; over: boolean }

export interface DayResponse {
  date: string;
  entries: Entry[];
  settings: Settings | null;
  week: WeekBar[];
  recent: Recent[];
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
