import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseList, parseMyItems, type ListLine, type MyItem } from '@/lib/shopping/home';
import { getHome, setHome, withMeta } from '@/models/ShoppingHome';

// The household's My items and its one shopping list (one doc, shared by
// everyone holding `shopping`). GET creates it from the old named lists the
// first time. PATCH { items?, list? } replaces either array.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json(await withMeta(await getHome()));
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
  if (body.items === undefined && body.list === undefined) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  try {
    const fields: { items?: MyItem[]; list?: ListLine[] } = {};
    if (body.items !== undefined) {
      const prev = (await getHome()).items;
      const r = parseMyItems(body.items, caller.userEmail, new Date().toISOString(), prev);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      fields.items = r.value;
    }
    if (body.list !== undefined) {
      const r = parseList(body.list);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      fields.list = r.value;
    }
    return NextResponse.json(await withMeta(await setHome(fields)));
  } catch (error) {
    console.error('Error updating shopping home:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
