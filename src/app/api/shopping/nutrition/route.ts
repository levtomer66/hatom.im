import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import type { NutritionResponse } from '@/lib/shopping/api-types';
import { isLiquid, nutritionOf, packGrams } from '@/lib/shopping/nutrition';
import { getItems } from '@/models/ShoppingCatalog';

const MAX_KEYS = 100;

// GET ?keys=<k1,k2,…> — per item, what the list's nutrition totals need:
// values per 100 g (`nu`, written by the ingest), pack size, weighed or not.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const keys = [...new Set((request.nextUrl.searchParams.get('keys') ?? '').split(',').map((k) => k.trim()).filter((k) => k && k.length <= 60))];
  if (!keys.length) return NextResponse.json({});
  if (keys.length > MAX_KEYS) return NextResponse.json({ error: `At most ${MAX_KEYS} keys` }, { status: 400 });
  try {
    const docs = await getItems(keys);
    const res: NutritionResponse = Object.fromEntries(docs.map((d) => [d._id, {
      nu: nutritionOf(d), pack: packGrams(d.q, d.uq), w: d.w, liquid: isLiquid(d.uq, d.d), d: d.d ?? null, name: d.n,
    }]));
    return NextResponse.json(res);
  } catch (error) {
    console.error('Error reading nutrition:', error);
    return NextResponse.json({ error: 'Failed to read nutrition' }, { status: 500 });
  }
}
