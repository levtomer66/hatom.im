import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { MAX_LIST_ITEMS, MAX_QTY } from '@/lib/shopping/lists';
import type { BasketLine } from '@/lib/shopping/pricing';
import { compareBasket, type CompareRequest } from '@/lib/shopping/service';

function parseBody(body: unknown): CompareRequest | string {
  if (!body || typeof body !== 'object') return 'body must be an object';
  const b = body as Record<string, unknown>;
  if (typeof b.city !== 'string' || !CITIES.some((c) => c.id === b.city)) return 'unknown city';
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > MAX_LIST_ITEMS) return 'lines must be a non-empty array';
  const lines: BasketLine[] = [];
  for (const l of b.lines as Record<string, unknown>[]) {
    if (typeof l?.key !== 'string' || l.key.length > 60) return 'bad line key';
    if (typeof l.qty !== 'number' || !(l.qty > 0) || l.qty > MAX_QTY) return `bad quantity for ${l.key}`;
    lines.push({ key: l.key, qty: l.qty });
  }
  return { city: b.city, lines, clubs: b.clubs === true, coupons: b.coupons === true };
}

// POST { city, lines, clubs?, coupons? } — the basket priced at every store
// serving the city: physical and online stores ranked separately, splits,
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
