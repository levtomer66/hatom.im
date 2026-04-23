import { NextRequest, NextResponse } from 'next/server';
import { requireTripAdmin } from '@/lib/tripAdmin';
import { reassignPhoto, UNASSIGNED_DAY } from '@/models/TripJourney';

const VALID_DAY = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/trip/journey/unassigned/assign
// Admin only. Body: { blobPath: string, toDay: 'YYYY-MM-DD' }.
// Moves a photo from the unassigned bucket onto a concrete day.
export async function POST(req: NextRequest) {
  const authErr = requireTripAdmin(req);
  if (authErr) return authErr;

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
