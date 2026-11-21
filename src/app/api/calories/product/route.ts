import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { candidates } from '@/lib/shopping/service';
import { getItems } from '@/models/ShoppingCatalog';
import { getLabel } from '@/models/Calories';
import { bad, productHit, serverError } from '../_shared';

// GET ?key=<item key or scanned barcode> — one product to log. A barcode is
// tried as-is and without leading zeros. 404 when the catalog has no such item.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
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
