import { NextRequest, NextResponse } from 'next/server';
import { requireTripAdmin } from '@/lib/tripAdmin';
import { getJourneyDay, updateDayNote } from '@/models/TripJourney';

// Day-dates have the shape 'YYYY-MM-DD' + the UNASSIGNED sentinel. Guard so
// we don't touch Mongo with arbitrary path segments.
const VALID_DAY = /^(__unassigned__|\d{4}-\d{2}-\d{2})$/;

// GET /api/trip/journey/[dayDate]
// Public. Full day document — photos (sorted by takenAt) + note.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dayDate: string }> }
) {
  const { dayDate } = await params;
  if (!VALID_DAY.test(dayDate)) {
    return NextResponse.json({ error: 'Invalid dayDate' }, { status: 400 });
  }
  const doc = await getJourneyDay(dayDate);
  if (!doc) {
    return NextResponse.json(
      { dayDate, photos: [], note: '' },
      { status: 200 }
    );
  }
  return NextResponse.json(doc);
}

// PATCH /api/trip/journey/[dayDate]
// Admin only. Updates the day's free-text note. Body: { note: string }.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ dayDate: string }> }
) {
  const authErr = requireTripAdmin(req);
  if (authErr) return authErr;

  const { dayDate } = await params;
  if (!VALID_DAY.test(dayDate)) {
    return NextResponse.json({ error: 'Invalid dayDate' }, { status: 400 });
  }

  let body: { note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON body' }, { status: 400 });
  }
  const note = typeof body.note === 'string' ? body.note : '';

  const updated = await updateDayNote(dayDate, note);
  return NextResponse.json(updated);
}
