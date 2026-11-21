import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { candidates } from '@/lib/shopping/service';
import { getItems } from '@/models/ShoppingCatalog';
import { getFood, getLabel } from '@/models/Calories';
import { bad, foodHit, productHit, serverError } from '../_shared';

// GET ?key=<item key or scanned barcode> — one product to log. A barcode is
// tried as-is and without leading zeros. 404 when the catalog has no such item.
// GET ?food=<MoH id> — one Ministry of Health food (an entry's values, for its edit sheet).
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
  const food = request.nextUrl.searchParams.get('food');
  if (food !== null) {
    if (!/^\d{1,9}$/.test(food)) return bad('מזון לא מוכר');
    try {
      const doc = await getFood(Number(food));
      return doc ? NextResponse.json(foodHit(doc)) : bad('מזון לא מוכר', 404);
    } catch (error) {
      return serverError('reading a food', error);
    }
  }
  const raw = (request.nextUrl.searchParams.get('key') ?? '').trim().slice(0, 60);
  if (!raw) return bad('חסר ברקוד');
  try {
    const keys = candidates(raw);
    const docs = await getItems(keys);
    const doc = keys.map((k) => docs.find((d) => d._id === k)).find(Boolean);
    if (!doc) return bad('לא מצאנו את הברקוד', 404);
    return NextResponse.json(productHit(doc, await getLabel(doc._id)));
  } catch (error) {
    return serverError('reading a product', error);
  }
}
