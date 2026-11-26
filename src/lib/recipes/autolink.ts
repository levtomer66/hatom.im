// Imported recipes link themselves (server): each line with an amount gets
// the best MoH generic food for its values, and the best catalog product to
// buy (and for its values too when no MoH food matched). Marked `auto` until
// someone checks them on the page.

import { toTotals } from '@/lib/calories/calories';
import type { FoodDoc } from '@/lib/calories/moh';
import { nutritionOf } from '@/lib/shopping/nutrition';
import { rankHits, searchPatterns } from '@/lib/shopping/search-rank';
import { getLabels, searchFoods } from '@/models/Calories';
import { foodProducts } from './products';
import type { Ingredient, Link } from './types';

const CONCURRENCY = 6;

/** The name, then shorter forms of it ("שמנת מתוקה 38%" → "שמנת מתוקה" → "שמנת"). */
function queries(name: string): string[] {
  const words = name.replace(/[^\p{L}\p{N}\s%]/gu, ' ').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let n = Math.min(words.length, 3); n >= 1; n--) out.push(words.slice(0, n).join(' '));
  // The MoH table names foods in the singular: "בננות" → "בננה", "עגבניות" → "עגבנייה", "ביצים" → "ביצ".
  const singular = words[0]?.replace(/יות$/, 'ייה').replace(/ות$/, 'ה').replace(/ים$/, '');
  if (singular && singular !== words[0]) out.push(singular);
  return out.filter((q) => q.length >= 2);
}

async function bestFood(name: string): Promise<FoodDoc | null> {
  for (const q of queries(name)) {
    const terms = searchPatterns(q);
    if (!terms.length) continue;
    const foods = await searchFoods(terms);
    // Of the best few, the plainest (shortest name): "פסטה, יבשה" over a brand's gluten-free pasta.
    const top = rankHits(foods.map((f) => ({ f, name: f.n, stores: 0 })), terms).slice(0, 5);
    if (top.length) return top.reduce((a, b) => (b.f.n.length < a.f.n.length ? b : a)).f;
  }
  return null;
}

/** A piece's grams from the food's own units ("יחידה בינונית"), for lines counted in pieces. */
function pieceGrams(f: FoodDoc): number | null {
  const u = f.units.find((x) => /בינונית/.test(x.name)) ?? f.units.find((x) => /יחידה/.test(x.name));
  return u && u.g > 0 ? u.g : null;
}

async function linkOne(ing: Ingredient): Promise<Ingredient> {
  if (ing.qty === null || ing.link || !ing.name.trim()) return ing;
  const [food, products] = await Promise.all([bestFood(ing.name).catch(() => null), foodProducts(ing.name, 1).catch(() => [])]);
  const prod = products[0] ?? null;
  let link: Link | null = null;
  const foodPer = food ? toTotals(food.nu) : null;
  if (food && foodPer) link = { ref: { kind: 'food', key: String(food._id) }, name: food.n, img: null, per100: foodPer };
  if (!link && prod) {
    const nu = nutritionOf(prod) ?? (await getLabels([prod._id])).get(prod._id) ?? null;
    const per = toTotals(nu);
    if (per) link = { ref: { kind: 'product', key: prod._id }, name: prod.n, img: prod.img ?? null, per100: per };
  }
  let grams = ing.grams;
  if (grams === null && food && (ing.unit === null || ing.unit === 'יחידה')) {
    const g = pieceGrams(food);
    if (g) grams = Math.round(g * ing.qty);
  }
  const key = prod && link?.ref.key !== prod._id ? prod._id : null;
  if (!link && !prod) return ing;
  return { ...ing, link, key: key ?? (link?.ref.kind === 'product' ? null : ing.key), grams, auto: true };
}

export async function autoLink(ings: Ingredient[]): Promise<Ingredient[]> {
  const out = [...ings];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ings.length) }, async () => {
    while (next < ings.length) {
      const n = next++;
      out[n] = await linkOne(ings[n]);
    }
  }));
  return out;
}
