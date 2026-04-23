import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { requireTripAdmin } from '@/lib/tripAdmin';
import { appendPhoto } from '@/models/TripJourney';
import { reverseGeocode } from '@/lib/reverseGeocode';
import { JourneyPhoto, UNASSIGNED_DAY } from '@/types/trip';

// Trip window — photos whose EXIF date falls outside this land in the
// "unassigned" bucket so the admin can hand-place them. Kept in sync with
// the progress-bar data-start / data-end attributes on public/trip.html.
const TRIP_START = '2026-04-15';
const TRIP_END   = '2026-05-20';

function isWithinTrip(dateStr: string): boolean {
  return dateStr >= TRIP_START && dateStr <= TRIP_END;
}

// Convert an ISO datetime to 'YYYY-MM-DD' in its OWN offset — i.e. we slice
// the ISO string directly rather than run it through UTC. When the client
// passes '2026-04-22T14:22:00-04:00', we want 2026-04-22, not 2026-04-22
// after a UTC normalisation (which could shift it off-by-one in NYC).
function dayDateFromIso(iso: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(iso);
  return m ? m[1] : null;
}

// POST /api/trip/journey/upload
// Admin only. multipart/form-data with:
//   file        — the resized JPEG (client-side compressed)
//   takenAt     — ISO8601 with offset, from EXIF DateTimeOriginal(+Offset)
//                 or a user override. Missing → unassigned bucket.
//   latitude    — optional numeric string from EXIF GPS.
//   longitude   — optional numeric string from EXIF GPS.
//   caption     — optional string.
//   originalMime — optional, the Content-Type of the source file before
//                  client-side resize (e.g. 'image/heic').
export async function POST(req: NextRequest) {
  const authErr = requireTripAdmin(req);
  if (authErr) return authErr;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const takenAtRaw = (form.get('takenAt') as string | null) ?? null;
  const latitudeRaw  = form.get('latitude')  as string | null;
  const longitudeRaw = form.get('longitude') as string | null;
  const captionRaw   = (form.get('caption') as string | null)   ?? undefined;
  const originalMime = (form.get('originalMime') as string | null) ?? undefined;

  // Decide the target day. If takenAt is missing, malformed, or outside the
  // trip window, the photo goes to the unassigned bucket; the client will
  // surface it and the admin can reassign manually.
  let dayDate = UNASSIGNED_DAY;
  const effectiveTakenAt = takenAtRaw ?? new Date().toISOString();
  if (takenAtRaw) {
    const parsed = dayDateFromIso(takenAtRaw);
    if (parsed && isWithinTrip(parsed)) {
      dayDate = parsed;
    }
  }

  const latitude  = latitudeRaw  ? Number(latitudeRaw)  : undefined;
  const longitude = longitudeRaw ? Number(longitudeRaw) : undefined;
  const hasGps = Number.isFinite(latitude) && Number.isFinite(longitude);

  // Build Blob path. Unassigned photos get their own prefix.
  // Keep the extension stable on '.jpg' because the client ships the
  // compressed JPEG; the originalMime field retains the source type.
  const id = randomUUID();
  const blobPath = `trip/${dayDate}/${id}.jpg`;

  try {
    // Fire the Blob put + Nominatim reverse-geocode in parallel — they don't
    // depend on each other and we'd rather have the photo live with or
    // without a label than block on geocoding. `reverseGeocode` never
    // throws; it returns null on any failure.
    const geocodePromise = hasGps ? reverseGeocode(latitude!, longitude!) : Promise.resolve(null);
    const [blob, locationLabel] = await Promise.all([
      put(blobPath, file, { access: 'public', contentType: 'image/jpeg' }),
      geocodePromise,
    ]);

    const photo: JourneyPhoto = {
      blobUrl:  blob.url,
      blobPath,
      takenAt:  effectiveTakenAt,
      latitude:  hasGps ? latitude  : undefined,
      longitude: hasGps ? longitude : undefined,
      locationLabel: locationLabel ?? undefined,
      caption:  captionRaw && captionRaw.length > 0 ? captionRaw : undefined,
      sizeBytes: file.size,
      originalMime,
    };

    const day = await appendPhoto(dayDate, photo);

    return NextResponse.json({
      photo,
      dayDate,
      unassigned: dayDate === UNASSIGNED_DAY,
      // How many photos the day now has — the client uses this to update the
      // calendar-cell badge without a second fetch.
      dayPhotoCount: day.photos.length,
    });
  } catch (err) {
    console.error('POST /api/trip/journey/upload failed:', err);
    return NextResponse.json(
      { error: 'Upload failed — see server logs.' },
      { status: 500 }
    );
  }
}
