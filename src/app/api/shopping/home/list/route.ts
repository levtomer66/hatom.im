import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parsePicks, pickMissing } from '@/lib/shopping/home';
import { addLines, householdFor, withMeta } from '@/models/ShoppingHome';

// POST { add: [{ key, qty }] } — the "מה חסר?" submit: picked My items go on
// the list at the given quantity (else the usual one). Items already on the
// list keep their quantity; keys that aren't My items are ignored.
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const picks = parsePicks(body);
  if (!picks.ok) return NextResponse.json({ error: picks.error }, { status: 400 });
  try {
    const home = await householdFor(caller.userEmail);
    return NextResponse.json(await withMeta(await addLines(home.id, pickMissing(home.items, picks.value))));
  } catch (error) {
    console.error('Error adding to the shopping list:', error);
    return NextResponse.json({ error: 'Failed to add to the list' }, { status: 500 });
  }
}
