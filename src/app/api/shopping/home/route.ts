import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { wrongHousehold } from '@/lib/shopping/household';
import { parseFavStores, parseList, parseMyItems, type ListLine, type MyItem } from '@/lib/shopping/home';
import { householdFor, setHome, withMeta } from '@/models/ShoppingHome';

// The caller's household: its My items, its one shopping list and its
// favorite stores. GET makes an empty household for someone who has none. PATCH { items?, list?, favStores? } replaces any of the arrays.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json(await withMeta(await householdFor(caller.userEmail)));
  } catch (error) {
    console.error('Error fetching shopping home:', error);
    return NextResponse.json({ error: 'Failed to fetch My items' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: Record<string, unknown>;
  try {
    const b = await request.json();
    if (!b || typeof b !== 'object') throw new Error();
    body = b;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (body.items === undefined && body.list === undefined && body.favStores === undefined) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  try {
    const home = await householdFor(caller.userEmail);
    // Made for a household the caller has since left: applying it would overwrite this one's arrays.
    if (wrongHousehold(body.home, home.id)) return NextResponse.json({ error: 'משק הבית השתנה' }, { status: 409 });
    const fields: { items?: MyItem[]; list?: ListLine[]; favStores?: number[] } = {};
    if (body.items !== undefined) {
      const prev = home.items;
      const r = parseMyItems(body.items, caller.userEmail, new Date().toISOString(), prev);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      fields.items = r.value;
    }
    if (body.list !== undefined) {
      const r = parseList(body.list);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      fields.list = r.value;
    }
    if (body.favStores !== undefined) {
      const r = parseFavStores(body.favStores);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      fields.favStores = r.value;
    }
    return NextResponse.json(await withMeta(await setHome(home.id, fields)));
  } catch (error) {
    console.error('Error updating shopping home:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
