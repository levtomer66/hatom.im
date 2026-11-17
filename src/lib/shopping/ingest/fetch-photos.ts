// Fills the photo caches the ingest reads (ingest/off.ts) — a local job you
// run by hand, separately from the price ingest because a first full pass is
// long:
//
//   npm run shopping:photos                  # Rami Levy: up to 3000 barcodes, most widely sold first
//   npm run shopping:photos -- --max 500     # a smaller batch
//   npm run shopping:photos -- --off         # also refresh Open Food Facts (monthly CSV, ~1.5 GB streamed)
//
// Barcodes come from the saved store states (state/stores/*.json.gz), so run
// it after an ingest; the next ingest (or --offline) puts the photos on items.
//
// Rami Levy: one HEAD per barcode on its image CDN (robots.txt allows
// /product/), 1.5 s apart; hits are kept, misses re-checked after 30 days.
// Open Food Facts: the bulk CSV export is streamed through gunzip and only the
// rows whose barcode we have are kept — never saved whole, at most monthly.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createGunzip, gunzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { RAMI_LEVY_IMG, barcodeKey, readOff, readRamiLevy, writeOff, writeRamiLevy } from './off.ts';

const UA = 'hatom-shopping-ingest/0.1 (personal price comparison; throttled)';
const GAP_MS = 1500;
const MISS_RECHECK_DAYS = 30;
const OFF_REFRESH_DAYS = 30;
const OFF_CSV = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';

const { values: args } = parseArgs({ options: { max: { type: 'string' }, off: { type: 'boolean', default: false } } });
const CACHE = process.env.SHOPPING_CACHE_DIR || join(homedir(), '.cache', 'hatom-shopping');
const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (d: string) => (Date.now() - Date.parse(d)) / 86_400_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Barcode → how many stores sell it, and whether a store's own source (Wolt) photographs it. */
function barcodes(): Map<string, { stores: number; photo: boolean }> {
  const dir = join(CACHE, 'state', 'stores');
  const out = new Map<string, { stores: number; photo: boolean }>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json.gz'))) {
    const st = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString('utf8')) as { items: { key: string; barcode: boolean; img?: string }[] };
    for (const it of st.items) {
      if (!it.barcode || !/^\d{8,14}$/.test(it.key)) continue;
      const cur = out.get(it.key) ?? { stores: 0, photo: false };
      cur.stores++;
      if (it.img) cur.photo = true;
      out.set(it.key, cur);
    }
  }
  return out;
}

async function ramiLevy(all: Map<string, { stores: number; photo: boolean }>, max: number) {
  const cache = readRamiLevy(CACHE);
  const due = [...all]
    .filter(([b, v]) => !v.photo && (!(b in cache) || (cache[b].startsWith('-') && daysSince(cache[b].slice(1)) > MISS_RECHECK_DAYS)))
    .sort((a, b) => b[1].stores - a[1].stores)
    .slice(0, max)
    .map(([b]) => b);
  console.log(`Rami Levy: ${due.length} barcodes to check (${Object.keys(cache).length} cached)`);
  let hits = 0;
  for (let i = 0; i < due.length; i++) {
    const b = due[i];
    const res = await fetch(RAMI_LEVY_IMG(b), { method: 'HEAD', headers: { 'User-Agent': UA } }).catch(() => null);
    // 200 = photo, 403 = none (S3 AccessDenied); anything else is transient: leave it for the next run.
    if (res?.status === 200 && res.headers.get('content-type')?.startsWith('image/')) {
      cache[b] = today();
      hits++;
    } else if (res?.status === 403 || res?.status === 404) {
      cache[b] = `-${today()}`;
    } else if (res?.status === 429 || (res?.status ?? 0) >= 500) {
      console.log(`  stopped at ${i}: HTTP ${res?.status} — try again later`);
      break;
    }
    if ((i + 1) % 100 === 0 || i === due.length - 1) {
      writeRamiLevy(CACHE, cache);
      console.log(`  ${i + 1}/${due.length} checked, ${hits} photos`);
    }
    await sleep(GAP_MS);
  }
  writeRamiLevy(CACHE, cache);
}

async function openFoodFacts(all: Map<string, unknown>) {
  const prev = readOff(CACHE);
  if (prev && daysSince(prev.at) < OFF_REFRESH_DAYS) {
    console.log(`Open Food Facts: ${Object.keys(prev.photos).length} photos from ${prev.at} — fresh enough, not refreshed`);
    return;
  }
  const ours = new Map([...all.keys()].map((b) => [barcodeKey(b), b]));
  console.log(`Open Food Facts: streaming ${OFF_CSV} for ${ours.size} barcodes…`);
  const res = await fetch(OFF_CSV, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const lines = createInterface({ input: Readable.fromWeb(res.body as never).pipe(createGunzip()), crlfDelay: Infinity });
  const photos: Record<string, string> = {};
  let cols: { code: number; img: number; small: number } | null = null;
  let n = 0;
  for await (const line of lines) {
    const f = line.split('\t');
    if (!cols) {
      cols = { code: f.indexOf('code'), img: f.indexOf('image_url'), small: f.indexOf('image_small_url') };
      if (cols.code < 0 || cols.img < 0) throw new Error('unexpected CSV header');
      continue;
    }
    if (++n % 500_000 === 0) console.log(`  ${n} rows, ${Object.keys(photos).length} ours with a photo`);
    const mine = ours.get(barcodeKey(f[cols.code] ?? ''));
    const url = f[cols.img] || f[cols.small];
    if (mine && url?.startsWith('https://')) photos[mine] = url;
  }
  writeOff(CACHE, { at: today(), photos });
  console.log(`Open Food Facts: ${Object.keys(photos).length} of our barcodes have a photo (${n} rows read)`);
}

const all = barcodes();
console.log(`${all.size} barcodes in saved state, ${[...all.values()].filter((v) => v.photo).length} with a Wolt photo`);
if (args.off) await openFoodFacts(all);
await ramiLevy(all, args.max ? Number(args.max) : 3000);
