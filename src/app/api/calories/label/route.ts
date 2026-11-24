import { NextRequest, NextResponse } from 'next/server';
import { parseLabel, toTotals } from '@/lib/calories/calories';
import { getItems } from '@/models/ShoppingCatalog';
import { setLabel } from '@/models/Calories';
import { bad, readJson, serverError, requireDiaryCaller } from '../_shared';

// PUT { key, nu } — values per 100 g typed from a package, for a catalog
// product that has none. Saved per barcode, for everyone.
export async function PUT(request: NextRequest) {
  const caller = await requireDiaryCaller(request);
  if (caller instanceof NextResponse) return caller;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.key !== 'string' || !b.key || b.key.length > 60) return bad('חסר מוצר');
  const nu = parseLabel(b.nu);
  if (!nu.ok) return bad(nu.error);
  try {
    if (!(await getItems([b.key])).length) return bad('המוצר לא נמצא', 404);
    await setLabel(b.key, nu.value, caller.userEmail);
    return NextResponse.json({ per100: toTotals(nu.value) });
  } catch (error) {
    return serverError('saving a label', error);
  }
}
