import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { buildMatch } from '@/lib/recipes/match-server';
import { canRead, getRecipe } from '@/models/Recipe';
import { notFound, serverError } from '../../_shared';

type Ctx = { params: Promise<{ id: string }> };

// GET ?servings=N — the 🛒 sheet: per ingredient, a product, an amount and
// whether it starts ticked. Needs shopping too.
export async function GET(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const shopper = await requireFeatureCaller(request, 'shopping');
  if (shopper instanceof NextResponse) return shopper;
  const { id } = await params;
  try {
    const r = await getRecipe(id);
    if (!r || !canRead(r, caller.userEmail)) return notFound();
    const n = Number(request.nextUrl.searchParams.get('servings'));
    const servings = Number.isInteger(n) && n >= 1 && n <= 100 ? n : r.servings;
    const { lines } = await buildMatch(r, caller.userEmail, servings);
    return NextResponse.json({ lines });
  } catch (error) {
    return serverError('matching products', error);
  }
}
