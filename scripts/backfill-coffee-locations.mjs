#!/usr/bin/env node
// Backfills `latitude`, `longitude`, and `locationLabel` on coffee
// reviews using a two-tier strategy that mirrors src/lib/resolveLocation:
//
//   1. If the review has a mapsUrl, extract the coords directly from
//      the Google Maps share link — 100 % accurate when present.
//   2. Otherwise, fall back to Israel-biased Nominatim on the
//      placeName. 1.1 s inter-request delay to respect Nominatim's
//      fair-use policy.
//
// Flags:
//   --apply   actually write the resolved values to Mongo (default: dry-run)
//   --force   re-process every review, even ones that already have coords.
//             Useful for sweeping stale/wrong pins after a strategy change.
//
// Usage:
//   node scripts/backfill-coffee-locations.mjs                 # dry-run
//   node scripts/backfill-coffee-locations.mjs --apply         # write missing
//   node scripts/backfill-coffee-locations.mjs --apply --force # re-resolve all

import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { MongoClient } from 'mongodb';

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const MONGO = process.env.MONGODB_URI;
if (!MONGO) { console.error('MONGODB_URI missing'); process.exit(1); }

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'hatom.im coffee reviews backfill (https://www.hatom.im)';
const DELAY_MS = 1100;

const COORD_PATTERNS = [
  /@(-?\d+\.\d+),(-?\d+\.\d+),\d+(?:\.\d+)?z/,
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]query=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i,
  /[?&]destination=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
];

function tryExtract(url) {
  for (const pat of COORD_PATTERNS) {
    const m = pat.exec(url);
    if (!m) continue;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  }
  return null;
}

async function coordsFromMapsUrl(url) {
  if (!url) return null;
  const direct = tryExtract(url);
  if (direct) return direct;
  if (!/^https?:\/\/(?:goo\.gl\/maps|maps\.app\.goo\.gl)\//i.test(url)) return null;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return tryExtract(res.url);
  } catch {
    return null;
  }
}

async function nominatim(query) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'il');
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

console.log(APPLY ? '*** APPLYING CHANGES ***' : '(dry-run — pass --apply to write)');
if (FORCE) console.log('FORCE: re-resolving every review, including ones with existing coords');

const client = new MongoClient(MONGO);
await client.connect();
const col = client.db().collection('coffeeReviews');

const filter = FORCE
  ? { placeName: { $exists: true, $ne: '' } }
  : {
      $and: [
        { placeName: { $exists: true, $ne: '' } },
        { $or: [{ latitude: { $exists: false } }, { latitude: null }] },
      ],
    };
const candidates = await col.find(filter).toArray();
console.log(`Found ${candidates.length} review(s)`);

let mapsUrlHits = 0;
let nominatimHits = 0;
let failed = 0;
let cleared = 0;
let needsDelay = false;

for (let i = 0; i < candidates.length; i++) {
  const r = candidates[i];
  const tag = `[${i + 1}/${candidates.length}] ${r.placeName}`;

  let resolved = null;
  let source = '';

  if (r.mapsUrl) {
    resolved = await coordsFromMapsUrl(r.mapsUrl);
    if (resolved) source = 'mapsUrl';
  }
  if (!resolved && r.placeName) {
    if (needsDelay) await new Promise((rs) => setTimeout(rs, DELAY_MS));
    resolved = await nominatim(r.placeName);
    needsDelay = true;
    if (resolved) source = 'nominatim';
  }

  if (resolved) {
    console.log(`  ${tag}`);
    console.log(`    → ${resolved.latitude.toFixed(4)}, ${resolved.longitude.toFixed(4)}  (${source}${resolved.locationLabel ? ' · ' + resolved.locationLabel : ''})`);
    if (source === 'mapsUrl') mapsUrlHits++;
    else nominatimHits++;
    if (APPLY) {
      const setDoc = {
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      };
      if (resolved.locationLabel) setDoc.locationLabel = resolved.locationLabel;
      await col.updateOne({ _id: r._id }, { $set: setDoc });
    }
  } else {
    console.log(`  ${tag}`);
    console.log('    no match');
    failed++;
    // In --force mode, wipe any stale pin so it doesn't keep showing
    // the previous (wrong) location on the map.
    if (FORCE && APPLY && (r.latitude || r.longitude || r.locationLabel)) {
      await col.updateOne(
        { _id: r._id },
        { $unset: { latitude: '', longitude: '', locationLabel: '' } },
      );
      cleared++;
      console.log('    (cleared stale pin)');
    }
  }
}

await client.close();

console.log();
console.log(`Resolved via mapsUrl:   ${mapsUrlHits}`);
console.log(`Resolved via Nominatim: ${nominatimHits}`);
console.log(`Unresolved:             ${failed}`);
if (FORCE) console.log(`Stale pins cleared:     ${cleared}`);
if (!APPLY) console.log('Dry-run only. Pass --apply to persist.');
