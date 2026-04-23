import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { requireTripAdmin } from '@/lib/tripAdmin';
import { removePhotoByBlobPath } from '@/models/TripJourney';

const VALID_DAY = /^(__unassigned__|\d{4}-\d{2}-\d{2})$/;

// DELETE /api/trip/journey/[dayDate]/photos
// Admin only. Body: { blobPath: string }. Removes the photo from the day's
// document and deletes the binary from Vercel Blob.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ dayDate: string }> }
) {
  const authErr = requireTripAdmin(req);
  if (authErr) return authErr;

  const { dayDate } = await params;
  if (!VALID_DAY.test(dayDate)) {
    return NextResponse.json({ error: 'Invalid dayDate' }, { status: 400 });
  }

  let body: { blobPath?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON body' }, { status: 400 });
  }
  const blobPath = typeof body.blobPath === 'string' ? body.blobPath : null;
  if (!blobPath) {
    return NextResponse.json({ error: 'Missing blobPath' }, { status: 400 });
  }

  const removed = await removePhotoByBlobPath(dayDate, blobPath);
  if (!removed) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  // Best-effort Blob delete. If it fails we've already pulled the reference
  // from Mongo so the photo is effectively gone from the UI; the orphan blob
  // is harmless and can be cleaned up later.
  try {
    await del(removed.blobUrl);
  } catch (err) {
    console.warn('Blob delete failed (orphan left behind):', err);
  }

  return NextResponse.json({ removed });
}
