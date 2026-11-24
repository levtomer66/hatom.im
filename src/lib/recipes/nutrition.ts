// A recipe's nutrition per serving, from its linked lines. Derived, never
// stored. Import-free (node --test).

import { entryTotals, sumTotals, scaleTotals } from '../calories/calories.ts';
import type { Ingredient, Totals } from './types.ts';

/**
 * Totals per serving over the lines with a link and grams (null when there are
 * none). `partial`: a line with an amount isn't counted. Lines with no amount
 * ("מלח לפי הטעם") never make it partial.
 */
export function perServing(r: { ingredients: Ingredient[]; servings: number }): { totals: Totals | null; partial: boolean } {
  const counted = r.ingredients.filter((i) => i.link && i.grams && i.grams > 0);
  const partial = r.ingredients.some((i) => i.qty !== null && !(i.link && i.grams && i.grams > 0));
  if (!counted.length) return { totals: null, partial };
  const sum = sumTotals(counted.map((i) => entryTotals(i.link!.per100, i.grams!)));
  return { totals: scaleTotals(sum, 1 / Math.max(1, r.servings)), partial };
}
