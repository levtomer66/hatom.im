// Server-side glue the /api/calories routes share: reading a JSON body, and
// turning catalog items, MoH foods and home-made meals into FoodHits.

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller, type FeatureCaller } from '@/lib/api-caller';
import { activePregnantOwner } from '@/lib/pregnancy-diary';
import { toTotals, unitsFor } from '@/lib/calories/calories';
import type { FoodDoc } from '@/lib/calories/moh';
import type { FoodHit, ProductResponse } from '@/lib/calories/api-types';
import { isLiquid, nutritionOf, packGrams, type Nutrition } from '@/lib/shopping/nutrition';
import type { ItemDoc } from '@/lib/shopping/snapshot';
import type { Drink } from '@/lib/pregnancy/drinks';

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
    ...(nu ? { label: nu } : {}),
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
  label: f.nu,
  units: unitsFor({ units: f.units }),
  source: 'moh',
});

export { mealHit } from '@/lib/calories/calories';

/** A built-in drink to log: one unit (its ml), its caffeine per unit. */
export const drinkHit = (d: Drink): FoodHit => ({
  ref: { kind: 'drink', key: d.id },
  name: d.name,
  img: null,
  per100: null,
  per: d.nu,
  units: [{ name: d.unit, g: d.g }],
  source: 'drink',
  caf: d.mg,
});

/**
 * The diary's gate for what /pregnancy uses (day, day/[id], search, product, label,
 * to-list): the `calories` permission, or a pregnant owner (`pregnancy` + an active
 * pregnancy of her own), so she logs food without `calories` granted separately
 * (docs/superpowers/specs/2026-11-24-pregnancy-design.md § Access). Changing goals,
 * weight, steps, workouts and home-made meals stays `calories`-only; the day's GET
 * reads her own goals and activity alongside the entries.
 */
export async function requireDiaryCaller(request: NextRequest): Promise<FeatureCaller | NextResponse> {
  const caller = await requireFeatureCaller(request, 'calories');
  if (!(caller instanceof NextResponse) || caller.status !== 403) return caller;
  const preg = await requireFeatureCaller(request, 'pregnancy');
  if (preg instanceof NextResponse) return caller;
  return (await activePregnantOwner(preg.userEmail)) ? preg : caller;
}
