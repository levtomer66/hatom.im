import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseListCreate } from '@/lib/shopping/lists';
import { createShoppingList, getShoppingLists } from '@/models/ShoppingList';

// GET — the lists the caller may see: every shared list plus their own personal ones.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json(await getShoppingLists(caller.userEmail));
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
  }
}

// POST { name, shared? } — a new list, personal unless `shared: true`.
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = parseListCreate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    return NextResponse.json(await createShoppingList(parsed.value.name, parsed.value.shared, caller.userEmail), { status: 201 });
  } catch (error) {
    console.error('Error creating shopping list:', error);
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}
