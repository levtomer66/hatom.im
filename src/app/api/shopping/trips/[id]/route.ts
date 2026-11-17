import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseTripPatch } from '@/lib/shopping/trips';
import { getShoppingList } from '@/models/ShoppingList';
import { changeStops, endTrip, getTrip, setNotThere, setTick } from '@/models/ShoppingTrip';

type Params = { params: Promise<{ id: string }> };

/** The trip, if the caller can see its list (a personal list's trip is a 404 to others). */
async function visibleTrip(id: string, email: string) {
  if (!ObjectId.isValid(id)) return null;
  const trip = await getTrip(id);
  return trip && (await getShoppingList(trip.listId, email)) ? trip : null;
}

// GET — the trip (polled while the in-store screen is open).
export async function GET(request: NextRequest, { params }: Params) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  try {
    const trip = await visibleTrip((await params).id, caller.userEmail);
    return trip ? NextResponse.json(trip) : NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  } catch (error) {
    console.error('Error reading shopping trip:', error);
    return NextResponse.json({ error: 'Failed to read trip' }, { status: 500 });
  }
}

// PATCH — one change: { tick: {key, on} } | { notThere: {key, on} } |
// { replace: {key, item} } | { move: {key, toStore} } | { qty: {key, qty} } |
// { end: true }.
export async function PATCH(request: NextRequest, { params }: Params) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = parseTripPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const { id } = await params;
    if (!(await visibleTrip(id, caller.userEmail))) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    const p = parsed.value;
    const trip = 'tick' in p ? await setTick(id, p.tick.key, p.tick.on, caller.userEmail)
      : 'notThere' in p ? await setNotThere(id, p.notThere.key, p.notThere.on)
        : 'end' in p ? await endTrip(id)
          : await changeStops(id, p);
    return trip ? NextResponse.json(trip) : NextResponse.json({ error: 'Trip already ended, or no such item' }, { status: 409 });
  } catch (error) {
    console.error('Error updating shopping trip:', error);
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 });
  }
}
