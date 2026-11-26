import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { getItems } from '@/models/ShoppingCatalog';
import { addLines, ensureMyItems, householdFor } from '@/models/ShoppingHome';
import { bad, readJson, serverError, requireDiaryCaller } from '../_shared';

// POST { key } — 🛒: one unit (1 kg when weighed) of a logged product onto the
// caller's household shopping list, and into My items as search does.
// Needs the shopping permission as well as calories.
export async function POST(request: NextRequest) {
  const caller = await requireDiaryCaller(request);
  if (caller instanceof NextResponse) return caller;
  const shopper = await requireFeatureCaller(request, 'shopping');
  if (shopper instanceof NextResponse) return shopper;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const key = (body as { key?: unknown } | null)?.key;
  if (typeof key !== 'string' || !key || key.length > 60) return bad('חסר מוצר');
  try {
    const [item] = await getItems([key]);
    if (!item) return bad('המוצר לא נמצא', 404);
    const home = await householdFor(caller.userEmail);
    const line = { key: item._id, name: item.n, qty: 1, w: item.w };
    await ensureMyItems(home.id, [line], caller.userEmail);
    await addLines(home.id, [line]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('adding to the shopping list', error);
  }
}
