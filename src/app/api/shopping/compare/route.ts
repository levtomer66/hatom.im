import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { compareBasket, parseBasketRequest, type CompareRequest } from '@/lib/shopping/service';

function parseBody(body: unknown): CompareRequest | string {
  const req = parseBasketRequest(body);
  if (typeof req === 'string') return req;
  if (typeof req.city !== 'string' || !CITIES.some((c) => c.id === req.city)) return 'unknown city';
  return { ...req, city: req.city };
}

// POST { city, lines, clubs?, coupons? } — the basket priced at every store
// serving the city: physical and online stores ranked separately,
// plans and each line's cheapest stores (see compareBasket).
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const req = parseBody(body);
  if (typeof req === 'string') return NextResponse.json({ error: req }, { status: 400 });
  try {
    return NextResponse.json(await compareBasket(req));
  } catch (error) {
    console.error('Error comparing shopping basket:', error);
    return NextResponse.json({ error: 'Compare failed' }, { status: 500 });
  }
}
