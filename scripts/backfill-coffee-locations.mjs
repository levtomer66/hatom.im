#!/usr/bin/env node
// Backfills `latitude`, `longitude`, and `locationLabel` on every coffee
// review that doesn't have a pin yet. Uses OpenStreetMap Nominatim's
// /search endpoint with a 1.1 sec inter-request delay to stay well
// under their 1 req/sec fair-use limit.
//
// Defaults to DRY-RUN. Pass --apply to actually write.
//
// Usage:
//   node scripts/backfill-coffee-locations.mjs              # dry-run
//   node scripts/backfill-coffee-locations.mjs --apply      # do it

import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { MongoClient } from 'mongodb';

const APPLY = process.argv.includes('--apply');
const MONGO = process.env.MONGODB_URI;
if (!MONGO) { console.error('MONGODB_URI missing'); process.exit(1); }

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'hatom.im coffee reviews backfill (https://www.hatom.im)';
const DELAY_MS = 1100;

console.log(APPLY ? '*** APPLYING CHANGES ***' : '(dry-run — pass --apply to write)');

async function geocode(query) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en,he' },
  });
  if (!res.ok) return null;
  const items = await res.json();
  if (!Array.isArray(items) || !items.length) return null;
  const hit = items[0];
  const lat = parseFloat(hit.lat);
  const lon = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const addr = hit.address ?? {};
  const head = addr.amenity || addr.shop || addr.tourism || addr.attraction
            || addr.building || addr.road || addr.neighbourhood || addr.suburb;
  const city = addr.city || addr.town || addr.village || addr.municipality;
  const label = head && city ? `${head}, ${city}`
              : head ?? city ?? (hit.display_name ?? '').split(',').slice(0, 2).join(',').trim();
  return { latitude: lat, longitude: lon, locationLabel: label };
}

const client = new MongoClient(MONGO);
await client.connect();
const col = client.db().collection('coffeeReviews');

const candidates = await col.find({
  $and: [
    { placeName: { $exists: true, $ne: '' } },
    { $or: [{ latitude: { $exists: false } }, { latitude: null }] },
  ],
}).toArray();

console.log(`Found ${candidates.length} review(s) needing a location`);

let succeeded = 0;
let failed = 0;
for (let i = 0; i < candidates.length; i++) {
  const r = candidates[i];
  console.log(`  [${i + 1}/${candidates.length}] ${r.placeName}`);
  try {
    const geo = await geocode(r.placeName);
    if (!geo) {
      console.log('    no match');
      failed++;
    } else {
      console.log(`    → ${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}  (${geo.locationLabel})`);
      if (APPLY) {
        await col.updateOne({ _id: r._id }, { $set: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          locationLabel: geo.locationLabel,
        }});
      }
      succeeded++;
    }
  } catch (err) {
    console.error(`    FAIL: ${err.message}`);
    failed++;
  }
  if (i < candidates.length - 1) {
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
}

await client.close();

console.log();
console.log(`Resolved: ${succeeded}`);
console.log(`No match / failed: ${failed}`);
if (!APPLY) console.log('Dry-run only. Pass --apply to persist.');
