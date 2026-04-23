import { NextResponse } from 'next/server';
import { getAllJourneySummaries } from '@/models/TripJourney';

// GET /api/trip/journey
// Public. Lightweight calendar-badge data: for each day that has at least
// one photo, { dayDate, photoCount, hasNote, thumbnailUrl }. Also reports
// unassignedCount so the admin panel can surface photos whose EXIF date
// could not be resolved.
export async function GET() {
  try {
    const data = await getAllJourneySummaries();
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/trip/journey failed:', err);
    return NextResponse.json(
      { error: 'Failed to load trip journey' },
      { status: 500 }
    );
  }
}
