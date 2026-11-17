import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseTripCreate } from '@/lib/shopping/trips';
import { getShoppingList } from '@/models/ShoppingList';
import { getOpenTrip, startTrip } from '@/models/ShoppingTrip';

// GET ?listId= — the list's open trip, or null.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  const listId = request.nextUrl.searchParams.get('listId') ?? '';
  if (!ObjectId.isValid(listId)) return NextResponse.json({ error: 'Invalid list id' }, { status: 400 });
  try {
    if (!(await getShoppingList(listId, caller.userEmail))) return NextResponse.json({ error: 'List not found' }, { status: 404 });
    return NextResponse.json(await getOpenTrip(listId));
  } catch (error) {
    console.error('Error reading shopping trip:', error);
    return NextResponse.json({ error: 'Failed to read trip' }, { status: 500 });
  }
}

// POST { listId, plan, city, stops, missing, estimate } — start a trip on the
// chosen plan, or join the list's open one (200 with it instead of 201).
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = parseTripCreate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!ObjectId.isValid(parsed.value.listId)) return NextResponse.json({ error: 'Invalid list id' }, { status: 400 });
  try {
    if (!(await getShoppingList(parsed.value.listId, caller.userEmail))) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    const { trip, created } = await startTrip(parsed.value, caller.userEmail);
    return NextResponse.json(trip, { status: created ? 201 : 200 });
  } catch (error) {
    console.error('Error starting shopping trip:', error);
    return NextResponse.json({ error: 'Failed to start trip' }, { status: 500 });
  }
}
