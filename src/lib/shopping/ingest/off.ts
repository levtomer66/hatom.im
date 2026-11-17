// Product photos by barcode from sources that aren't stores here: the
// Rami Levy image CDN and Open Food Facts. `npm run shopping:photos` fills
// the caches (ingest/fetch-photos.ts); the ingest only reads them (cachedPhotos).
// Source notes and terms: docs/shopping-photo-sources.md.
//
//   photos/ramilevy.json  { [barcode]: "YYYY-MM-DD" (hit) | "-YYYY-MM-DD" (miss, re-checked after 30 days) }
//   photos/off.json       { at: "YYYY-MM-DD", photos: { [barcode]: url } } — from the monthly CSV export

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { BarcodePhoto } from '../snapshot.ts';
import { join } from 'node:path';

export const RAMI_LEVY_IMG = (barcode: string, size: 'small' | 'large' = 'small') =>
  `https://img.rami-levy.co.il/product/${barcode}/${size}.jpg`;

export type ProbeCache = Record<string, string>;

export const photosDir = (cacheDir: string) => {
  const dir = join(cacheDir, 'photos');
  mkdirSync(dir, { recursive: true });
  return dir;
};

const readJson = <T,>(p: string, fallback: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : fallback);

export const readRamiLevy = (cacheDir: string) => readJson<ProbeCache>(join(photosDir(cacheDir), 'ramilevy.json'), {});
export const writeRamiLevy = (cacheDir: string, c: ProbeCache) => writeFileSync(join(photosDir(cacheDir), 'ramilevy.json'), JSON.stringify(c));
export const readOff = (cacheDir: string) => readJson<{ at: string; photos: Record<string, string> } | null>(join(photosDir(cacheDir), 'off.json'), null);
export const writeOff = (cacheDir: string, v: { at: string; photos: Record<string, string> }) =>
  writeFileSync(join(photosDir(cacheDir), 'off.json'), JSON.stringify(v));

/** Barcodes compared without leading zeros (OFF pads UPC-12 to 13 digits). */
export const barcodeKey = (b: string) => b.replace(/^0+/, '');

/**
 * barcode → photo for the ingest: Rami Levy's CDN where it has the barcode
 * (`first`: it beats Wolt's photos, which are only a fallback — Wolt's terms),
 * else Open Food Facts (`by: 'off'`, CC BY-SA — the app credits it).
 */
export function cachedPhotos(cacheDir: string): Map<string, BarcodePhoto> {
  const out = new Map<string, BarcodePhoto>();
  const off = readOff(cacheDir);
  for (const [b, img] of Object.entries(off?.photos ?? {})) out.set(b, { img, by: 'off' });
  for (const [b, v] of Object.entries(readRamiLevy(cacheDir))) if (!v.startsWith('-')) out.set(b, { img: RAMI_LEVY_IMG(b), first: true });
  return out;
}
