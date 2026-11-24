// A recipe as something /calories can log: one serving per unit, its values
// per serving frozen on the entry when logged. Import-free (node --test).

import { scaleTotals, type Entry } from '../calories/calories.ts';
import type { FoodHit } from '../calories/api-types.ts';
import { perServing } from './nutrition.ts';
import type { Recipe } from './types.ts';

/** Grams of one serving (all lines with grams, linked or not), at least 1. */
const servingGrams = (r: Recipe) => Math.round(r.ingredients.reduce((a, i) => a + (i.grams ?? 0), 0) / Math.max(1, r.servings)) || 1;

/** For calories' search ("מתכונים שלי" in the meals group); null when no line is linked. */
export function recipeHit(r: Recipe): FoodHit | null {
  const { totals } = perServing(r);
  if (!totals) return null;
  return { ref: { kind: 'recipe', key: r.id }, name: r.name, img: r.photo, per100: null, per: totals, units: [{ name: 'מנה', g: servingGrams(r) }], source: 'recipe' };
}

/** `qty` servings as a diary entry (without id/at/meal); null when no line is linked. */
export function recipeEntry(r: Recipe, qty: number): Omit<Entry, 'id' | 'at' | 'meal'> | null {
  const { totals } = perServing(r);
  if (!totals) return null;
  const nu = scaleTotals(totals, qty);
  return { name: r.name.slice(0, 80), img: r.photo, ref: { kind: 'recipe', key: r.id }, unit: { name: 'מנה', g: servingGrams(r) }, qty, nu, base: { qty, nu } };
}
