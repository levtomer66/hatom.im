import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseTripCreate } from '@/lib/shopping/trips';
import { householdFor } from '@/models/ShoppingHome';
import { getOpenTrip, startTrip } from '@/models/ShoppingTrip';

// GET — the household list's open trip, or null.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json(await getOpenTrip((await householdFor(caller.userEmail)).id));
  } catch (error) {
    console.error('Error reading shopping trip:', error);
    return NextResponse.json({ error: 'Failed to read trip' }, { status: 500 });
  }
}

// POST { plan, city, stops, missing, estimate } — start a trip on the
// chosen plan, or join the open one (every trip is on the household list;
// a `listId` in the body is ignored) (200 with it instead of 201).
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
  try {
    const { trip, created } = await startTrip({ ...parsed.value, listId: (await householdFor(caller.userEmail)).id }, caller.userEmail);
    return NextResponse.json(trip, { status: created ? 201 : 200 });
  } catch (error) {
    console.error('Error starting shopping trip:', error);
    return NextResponse.json({ error: 'Failed to start trip' }, { status: 500 });
  }
}
