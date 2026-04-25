import { NextRequest, NextResponse } from 'next/server';
import { Collection } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { requireTripAdmin } from '@/lib/tripAdmin';
import { reverseGeocode } from '@/lib/reverseGeocode';
import { TripJourneyDay } from '@/types/trip';

const COLLECTION_NAME = 'tripJourney';

// Be a polite Nominatim citizen even though they cache for us — the local LRU
// in reverseGeocode handles same-coord repeats, but distinct rounded coords
// still hit the wire. Stay well under the 1 req/sec fair-use bar.
const NOMINATIM_DELAY_MS = 250;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getCollection(): Promise<Collection<TripJourneyDay>> {
  const client = await clientPromise;
  return client.db().collection<TripJourneyDay>(COLLECTION_NAME);
}

// POST /api/trip/journey/regeocode
// Admin only. One-shot backfill: walks every day doc, recomputes
// `locationLabel` for every photo with GPS using the (now stabilised)
// reverseGeocode picker, and writes the doc back. Photos with no GPS, or
// photos whose Nominatim call returns null, are left untouched.
//
// Returns { scanned, updated, unchanged, skipped } so the admin UI can show
// a single toast summarising the run.
export async function POST(req: NextRequest) {
  const authErr = requireTripAdmin(req);
  if (authErr) return authErr;

  try {
    const col = await getCollection();
    const docs = await col.find({}).toArray();

    let scanned = 0;
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;

    for (const doc of docs) {
      let dirty = false;
      const newPhotos = [...doc.photos];

      for (let i = 0; i < newPhotos.length; i++) {
        const p = newPhotos[i];
        scanned++;
        if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') {
          skipped++;
          continue;
        }
        const label = await reverseGeocode(p.latitude, p.longitude);
        // Throttle between calls. The cache inside reverseGeocode skips the
        // sleep when we hit it (network call didn't happen), but on a cache
        // miss we still want to space requests. Cheap heuristic: always
        // sleep after a non-skipped photo. Slightly conservative; fine for a
        // one-shot backfill that runs to completion in a few minutes.
        await sleep(NOMINATIM_DELAY_MS);

        if (label && label !== p.locationLabel) {
          newPhotos[i] = { ...p, locationLabel: label };
          dirty = true;
          updated++;
        } else {
          unchanged++;
        }
      }

      if (dirty) {
        await col.updateOne(
          { dayDate: doc.dayDate },
          {
            $set: {
              photos: newPhotos,
              updatedAt: new Date().toISOString(),
            },
          }
        );
      }
    }

    return NextResponse.json({ scanned, updated, unchanged, skipped });
  } catch (err) {
    console.error('POST /api/trip/journey/regeocode failed:', err);
    return NextResponse.json(
      { error: 'Re-geocode failed — see server logs.' },
      { status: 500 }
    );
  }
}
