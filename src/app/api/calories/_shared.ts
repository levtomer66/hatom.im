// Server-side glue the /api/calories routes share: reading a JSON body, and
// turning catalog items, MoH foods and home-made meals into FoodHits.

import { NextRequest, NextResponse } from 'next/server';
import { toTotals, unitsFor, type MealDoc } from '@/lib/calories/calories';
import type { FoodDoc } from '@/lib/calories/moh';
import type { FoodHit, ProductResponse } from '@/lib/calories/api-types';
import { isLiquid, nutritionOf, packGrams, type Nutrition } from '@/lib/shopping/nutrition';
import type { ItemDoc } from '@/lib/shopping/snapshot';

export async function readJson(request: NextRequest): Promise<unknown | NextResponse> {
  try {
    return await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export function serverError(what: string, error: unknown) {
  console.error(`calories: ${what}:`, error);
  return NextResponse.json({ error: 'משהו השתבש, נסו שוב' }, { status: 500 });
}

/** A catalog item, with values from its own `nu` or else a label someone typed. */
export function productHit(d: ItemDoc, label: Nutrition | null | undefined): ProductResponse {
  const nu = nutritionOf(d) ?? label ?? null;
  const liquid = isLiquid(d.uq, d.d);
  return {
    key: d._id,
    ref: { kind: 'product', key: d._id },
    name: d.n,
    img: d.img ?? null,
    per100: toTotals(nu),
    units: unitsFor({ pack: packGrams(d.q, d.uq), w: d.w, liquid }),
    source: nu?.by === 'manual' ? 'manual' : nu?.by === 'moh' ? 'moh' : 'off',
    maker: d.m || undefined,
    w: d.w,
    liquid,
  };
}

export const foodHit = (f: FoodDoc): FoodHit => ({
  ref: { kind: 'food', key: String(f._id) },
  name: f.n,
  img: null,
  per100: toTotals(f.nu),
  units: unitsFor({ units: f.units }),
  source: 'moh',
});

export const mealHit = (m: MealDoc): FoodHit => ({
  ref: { kind: 'meal', key: m.id },
  name: m.name,
  img: null,
  per100: null,
  per: m.per,
  units: [{ name: 'מנה', g: Math.round(m.items.reduce((a, i) => a + i.grams, 0) / m.portions) || 1 }],
  source: 'meal',
});
