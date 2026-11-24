import { NextRequest, NextResponse } from 'next/server';
import type { SearchResponse } from '@/lib/calories/api-types';
import { isFood } from '@/lib/shopping/nutrition';
import { rankHits, searchPatterns } from '@/lib/shopping/search-rank';
import { findProducts } from '@/lib/shopping/service';
import { getLabels, listMeals, searchFoods } from '@/models/Calories';
import { drinksMatching } from '@/lib/pregnancy/drinks';
import { drinkHit, foodHit, mealHit, productHit, serverError, requireDiaryCaller } from '../_shared';

const MEALS_SHOWN = 10;
const FOODS_SHOWN = 15;
const PRODUCTS_SHOWN = 20;

// GET ?q= — what to log: the caller's home-made meals, MoH generic foods and
// catalog products (food departments only), each best match first.
export async function GET(request: NextRequest) {
  const caller = await requireDiaryCaller(request);
  if (caller instanceof NextResponse) return caller;
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ meals: [], foods: [], products: [] } satisfies SearchResponse);
  try {
    const terms = searchPatterns(q);
    const [meals, foods, found] = await Promise.all([listMeals(caller.userEmail), searchFoods(terms), findProducts(q)]);
    const matches = (name: string) => terms.every((t) => new RegExp(t, 'iu').test(name));
    const rankedFoods = rankHits(foods.map((f) => ({ f, name: f.n, stores: 0 })), terms).slice(0, FOODS_SHOWN);
    const items = rankHits(
      found.docs.filter((d) => isFood(d.d)).map((d) => ({ d, name: d.n, manufacturer: d.m, aka: d.s, stores: Object.keys(d.p).length })),
      found.terms, found.loose,
    ).slice(0, PRODUCTS_SHOWN);
    const labels = await getLabels(items.map((h) => h.d._id));
    const res: SearchResponse = {
      meals: meals.filter((m) => matches(m.name)).slice(0, MEALS_SHOWN).map(mealHit),
      foods: rankedFoods.map((h) => foodHit(h.f)),
      products: items.map((h) => productHit(h.d, labels.get(h.d._id))),
      drinks: drinksMatching(q).slice(0, 6).map(drinkHit),
    };
    return NextResponse.json(res);
  } catch (error) {
    return serverError('searching', error);
  }
}
