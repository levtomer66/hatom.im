import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { reassignPhoto, UNASSIGNED_DAY } from '@/models/TripJourney';

const VALID_DAY = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/trip/journey/unassigned/assign
// Requires the `trip:write` permission. Body: { blobPath: string,
// toDay: 'YYYY-MM-DD' }. Moves a photo from the unassigned bucket onto
// a concrete day.
export async function POST(req: NextRequest) {
  const gate = await requirePagePermission('trip:write');
  if (gate instanceof NextResponse) return gate;

  let body: { blobPath?: unknown; toDay?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON body' }, { status: 400 });
  }
  const blobPath = typeof body.blobPath === 'string' ? body.blobPath : null;
  const toDay    = typeof body.toDay === 'string' ? body.toDay : null;
  if (!blobPath || !toDay || !VALID_DAY.test(toDay)) {
    return NextResponse.json({ error: 'blobPath and toDay (YYYY-MM-DD) required' }, { status: 400 });
  }

  const moved = await reassignPhoto(UNASSIGNED_DAY, toDay, blobPath);
  if (!moved) {
    return NextResponse.json({ error: 'Photo not found in unassigned bucket' }, { status: 404 });
  }
  return NextResponse.json({ moved, toDay });
}
