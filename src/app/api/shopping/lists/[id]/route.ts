import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseListPatch } from '@/lib/shopping/lists';
import { deleteShoppingList, updateShoppingList } from '@/models/ShoppingList';

type Params = { params: Promise<{ id: string }> };

// PATCH — rename and/or replace the items (send the whole item array).
export async function PATCH(request: NextRequest, { params }: Params) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid list id' }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = parseListPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const list = await updateShoppingList(id, parsed.value);
    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });
    return NextResponse.json(list);
  } catch (error) {
    console.error('Error updating shopping list:', error);
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid list id' }, { status: 400 });
  try {
    if (!(await deleteShoppingList(id))) return NextResponse.json({ error: 'List not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting shopping list:', error);
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 });
  }
}
