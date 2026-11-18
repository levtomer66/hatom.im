import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseTripPatch } from '@/lib/shopping/trips';
import { HOME_LIST_ID } from '@/lib/shopping/home';
import { priceLinesAt } from '@/lib/shopping/service';
import { getHome, pullBought } from '@/models/ShoppingHome';
import { addToTrip, changeStops, endTrip, getTrip, setNotThere, setTick } from '@/models/ShoppingTrip';

type Params = { params: Promise<{ id: string }> };

/** The trip, if it is on the household list (trips on the old named lists are no longer reachable). */
async function visibleTrip(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const trip = await getTrip(id);
  return trip && trip.listId === HOME_LIST_ID ? trip : null;
}

/** Ends the trip and takes what was bought off the list (not-there items stay). */
async function endAndClear(id: string) {
  const trip = await endTrip(id);
  if (trip) await pullBought(trip.ticked, trip.notThere);
  return trip;
}

/** Takes on the list lines added since the trip started ("מה חסר?" after "יוצאים לקניות"). */
async function syncWithList(id: string) {
  const trip = await getTrip(id);
  if (!trip || trip.endedAt) return null;
  const known = new Set([...trip.stops.flatMap((s) => s.items.map((i) => i.key)), ...trip.missing.map((m) => m.key)]);
  const fresh = (await getHome()).list.filter((l) => !known.has(l.key));
  if (!fresh.length) return trip;
  return addToTrip(id, await priceLinesAt(fresh, trip.stops.map((s) => s.store)));
}

// GET — the trip (polled while the in-store screen is open).
export async function GET(request: NextRequest, { params }: Params) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  try {
    const trip = await visibleTrip((await params).id);
    return trip ? NextResponse.json(trip) : NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  } catch (error) {
    console.error('Error reading shopping trip:', error);
    return NextResponse.json({ error: 'Failed to read trip' }, { status: 500 });
  }
}

// PATCH — one change: { tick: {key, on} } | { notThere: {key, on} } |
// { replace: {key, item} } | { move: {key, toStore} } | { qty: {key, qty} } |
// { sync: true } (take on new list lines) | { end: true }.
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
    if (!(await visibleTrip(id))) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    const p = parsed.value;
    const trip = 'tick' in p ? await setTick(id, p.tick.key, p.tick.on, caller.userEmail)
      : 'notThere' in p ? await setNotThere(id, p.notThere.key, p.notThere.on)
        : 'end' in p ? await endAndClear(id)
          : 'sync' in p ? await syncWithList(id)
          : await changeStops(id, p);
    return trip ? NextResponse.json(trip) : NextResponse.json({ error: 'Trip already ended, or no such item' }, { status: 409 });
  } catch (error) {
    console.error('Error updating shopping trip:', error);
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 });
  }
}
