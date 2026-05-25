#!/usr/bin/env node
// Backfills `thumbUrl` + `thumbPath` on every existing tripJourney photo
// in Mongo. For each photo without a thumb:
//   1. fetch the blobUrl (Vercel Blob, public).
//   2. generate a 400 px WebP thumb with sharp (q=72).
//   3. upload to Blob alongside the original as <blobPath>-thumb.webp.
//   4. update the embedded photo subdoc.
//
// Defaults to DRY-RUN. Pass --apply to actually write.
//
// Usage:
//   node scripts/backfill-trip-thumbs.mjs            # dry-run
//   node scripts/backfill-trip-thumbs.mjs --apply    # do it

import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { MongoClient } from 'mongodb';
import sharp from 'sharp';
import { put } from '@vercel/blob';

const APPLY = process.argv.includes('--apply');
const MONGO = process.env.MONGODB_URI;
if (!MONGO) { console.error('MONGODB_URI missing'); process.exit(1); }
if (!process.env.BLOB_READ_WRITE_TOKEN) { console.error('BLOB_READ_WRITE_TOKEN missing'); process.exit(1); }

console.log(APPLY ? '*** APPLYING CHANGES ***' : '(dry-run — pass --apply to write)');

const client = new MongoClient(MONGO);
await client.connect();
const col = client.db().collection('tripJourney');

const docs = await col.find({}).toArray();
console.log(`Scanning ${docs.length} day docs`);

let totalPhotos = 0;
let needsBackfill = 0;
let succeeded = 0;
let failed = 0;

for (const doc of docs) {
  if (!doc.photos?.length) continue;
  let docChanged = false;

  for (let i = 0; i < doc.photos.length; i++) {
    const p = doc.photos[i];
    totalPhotos++;
    if (p.thumbUrl) continue;
    needsBackfill++;

    const path = (p.blobPath ?? '').replace(/\.[^.]+$/, '') + '-thumb.webp';
    console.log(`  ${doc.dayDate} #${i}: ${p.blobPath} → ${path}`);

    if (!APPLY) continue;

    try {
      const res = await fetch(p.blobUrl);
      if (!res.ok) throw new Error(`fetch ${p.blobUrl} → ${res.status}`);
      const srcBuf = Buffer.from(await res.arrayBuffer());
      const thumbBuf = await sharp(srcBuf)
        .rotate()
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72, effort: 5 })
        .toBuffer();
      const blob = await put(path, thumbBuf, {
        access: 'public',
        contentType: 'image/webp',
        addRandomSuffix: true,
      });
      doc.photos[i].thumbUrl = blob.url;
      doc.photos[i].thumbPath = path;
      docChanged = true;
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`    FAIL: ${err.message}`);
    }
  }

  if (APPLY && docChanged) {
    await col.updateOne({ _id: doc._id }, { $set: { photos: doc.photos } });
    console.log(`  saved doc ${doc.dayDate}`);
  }
}

await client.close();

console.log();
console.log(`Scanned ${totalPhotos} photos`);
console.log(`Needed backfill: ${needsBackfill}`);
if (APPLY) {
  console.log(`Backfilled: ${succeeded}`);
  console.log(`Failed: ${failed}`);
}
