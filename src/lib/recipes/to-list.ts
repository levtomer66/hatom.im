// 🛒 sheet defaults: per ingredient with an amount, the product to buy, how
// much, and whether it starts ticked. Import-free (node --test).

import type { MatchLine } from './api-types.ts';
import { isPantry } from './pantry.ts';
import { scaleLine } from './scale.ts';
import type { Ingredient } from './types.ts';

/** kg of a weighed product for `grams` (scaled), rounded up to 0.1; 1 kg when the grams aren't known. */
export const weighedKg = (grams: number | null, factor: number): number =>
  grams ? Math.max(0.1, Math.ceil((grams * factor) / 100) / 10) : 1;

export function matchDefaults(
  ings: Ingredient[],
  products: Map<string, MatchLine['product']>,
  onList: Set<string>,
  factor: number,
): MatchLine[] {
  return ings.filter((i) => i.qty !== null).map((i) => {
    const product = products.get(i.id) ?? null;
    return {
      id: i.id,
      text: scaleLine(i, factor),
      product,
      qty: product?.w ? weighedKg(i.grams, factor) : 1,
      ticked: !!product && !isPantry(i.name) && !onList.has(product.key),
    };
  });
}
