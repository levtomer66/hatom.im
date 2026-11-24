// The 🛒 sheet's lines for a recipe (server): each line's product — its own
// `key`, else its product link, else the best catalog match for its name —
// and what's already on the caller's household list. Used by the match
// route and the recipes_to_list MCP tool.

import { getItems } from '@/models/ShoppingCatalog';
import { householdFor } from '@/models/ShoppingHome';
import type { MatchLine } from './api-types';
import { foodProducts, productLite } from './products';
import { matchDefaults } from './to-list';
import type { Recipe } from './types';

const CONCURRENCY = 6;

async function mapLimited<T, R>(list: T[], f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
    while (next < list.length) {
      const n = next++;
      out[n] = await f(list[n]);
    }
  }));
  return out;
}

export async function buildMatch(recipe: Recipe, email: string, servings: number): Promise<{ lines: MatchLine[]; householdId: string }> {
  const withQty = recipe.ingredients.filter((i) => i.qty !== null && (i.name || i.text).trim());
  const ownKey = (i: Recipe['ingredients'][number]) => i.key ?? (i.link?.ref.kind === 'product' ? i.link.ref.key : null);
  const known = [...new Set(withQty.map(ownKey).filter((k): k is string => !!k))];
  const [docs, home] = await Promise.all([known.length ? getItems(known) : Promise.resolve([]), householdFor(email)]);
  const byKey = new Map(docs.map((d) => [d._id, productLite(d)]));
  const products = new Map<string, MatchLine['product']>();
  const searched = await mapLimited(withQty.filter((i) => !byKey.has(ownKey(i) ?? '')), async (i) => {
    const [best] = await foodProducts(i.name || i.text, 1).catch(() => []);
    return [i.id, best ? productLite(best) : null] as const;
  });
  for (const i of withQty) { const k = ownKey(i); if (k && byKey.has(k)) products.set(i.id, byKey.get(k)!); }
  for (const [id, p] of searched) products.set(id, p);
  const onList = new Set(home.list.map((l) => l.key));
  return { lines: matchDefaults(withQty, products, onList, servings / recipe.servings), householdId: home.id };
}
