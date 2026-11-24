import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { foodProducts, productLite } from '@/lib/recipes/products';
import { serverError } from '../_shared';

// GET ?q= — catalog products (food departments) for a recipe line: to buy in
// 🛒, or to link a line for someone without the calories search. No prices.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ products: [] });
  try {
    return NextResponse.json({ products: (await foodProducts(q)).map(productLite) });
  } catch (error) {
    return serverError('searching products', error);
  }
}
