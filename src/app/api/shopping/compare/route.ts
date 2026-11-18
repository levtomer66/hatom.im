import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { nearFor } from '@/lib/shopping/near-server';
import { compareBasket, parseBasketRequest } from '@/lib/shopping/service';

// POST { lat?, lng?, r?, favs?, lines, clubs?, coupons? } — the basket priced at
// every near store (within r km of lat/lng, else of the household's home
// spot, plus ★ and online): physical and online stores ranked separately,
// plans and each line's cheapest stores (see compareBasket). `favs`: the
// page's current favorites (a star just tapped counts), else the saved ones. An old client's
// `city` is ignored.
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const req = parseBasketRequest(body);
  if (typeof req === 'string') return NextResponse.json({ error: req }, { status: 400 });
  try {
    const near = await nearFor(caller.userEmail, req);
    if (typeof near === 'string') return NextResponse.json({ error: near }, { status: 400 });
    return NextResponse.json(await compareBasket({ near, lines: req.lines, clubs: req.clubs, coupons: req.coupons }));
  } catch (error) {
    console.error('Error comparing shopping basket:', error);
    return NextResponse.json({ error: 'Compare failed' }, { status: 500 });
  }
}
