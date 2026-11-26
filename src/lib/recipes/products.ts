// Catalog products for a recipe line (server): the food-department hits for
// a name, best first. Used by the products route, the 🛒 match and the MCP
// auto-linking.

import { isFood } from '@/lib/shopping/nutrition';
import { rankHits } from '@/lib/shopping/search-rank';
import { findProducts } from '@/lib/shopping/service';
import type { ItemDoc } from '@/lib/shopping/snapshot';
import type { ProductLite } from './api-types';

export async function foodProducts(q: string, limit = 20): Promise<ItemDoc[]> {
  const found = await findProducts(q.slice(0, 80));
  return rankHits(
    found.docs.filter((d) => isFood(d.d)).map((d) => ({ d, name: d.n, manufacturer: d.m, aka: d.s, stores: Object.keys(d.p).length })),
    found.terms, found.loose,
  ).slice(0, limit).map((h) => h.d);
}

export const productLite = (d: ItemDoc): ProductLite => ({ key: d._id, name: d.n, img: d.img ?? null, w: d.w });
