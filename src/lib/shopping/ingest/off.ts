// Product photos from Open Food Facts, by barcode, for items Wolt doesn't
// photograph. OFF allows ~10 search requests a minute per IP (and 15 product
// reads), so we never look items up one by one: the search API lists every
// product tagged Israel, 100 per page (~95 pages, ~10 minutes), and the result
// is cached as places/../off/israel-<YYYYMMDD>.json and reused for a week.
// OFF data is ODbL and its photos are CC BY-SA: the app credits "Open Food
// Facts" wherever it shows one (items carry imgBy: 'off').

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEARCH = 'https://world.openfoodfacts.org/api/v2/search';
const USER_AGENT = 'hatom-shopping-ingest/0.1 (personal price comparison; weekly, throttled)';
const GAP_MS = 6500; // ≤10 requests a minute
const PAGE_SIZE = 100; // the API caps page_size at 100
const MAX_PAGES = 200;
const REUSE_DAYS = 7;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SearchPage {
  count?: number;
  products?: { code?: string; image_front_url?: string; image_front_small_url?: string }[];
}

/**
 * barcode → front photo link (400 px). Reads the newest cached list; with
 * `fetch` and a list older than a week (or none), downloads a fresh one.
 */
export async function offPhotos(cacheDir: string, opts: { fetch: boolean; log: (m: string) => void }): Promise<Map<string, string>> {
  const dir = join(cacheDir, 'off');
  mkdirSync(dir, { recursive: true });
  const cached = readdirSync(dir).filter((f) => /^israel-\d{8}\.json$/.test(f)).sort().pop();
  const ageDays = cached ? (Date.now() - Date.parse(`${cached.slice(7, 11)}-${cached.slice(11, 13)}-${cached.slice(13, 15)}`)) / 86_400_000 : Infinity;
  let photos: Record<string, string> | null = cached ? JSON.parse(readFileSync(join(dir, cached), 'utf8')) : null;
  if (opts.fetch && ageDays >= REUSE_DAYS) {
    try {
      photos = await download(dir, opts.log);
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      writeFileSync(join(dir, `israel-${day}.json`), JSON.stringify(photos));
    } catch (e) {
      opts.log(`! Open Food Facts: ${e instanceof Error ? e.message : String(e)} — ${cached ? `keeping ${cached}` : 'no photos from it this run'}`);
    }
  }
  return new Map(Object.entries(photos ?? {}));
}

/**
 * Pages done so far are kept in off/israel-partial.json, so a run that OFF
 * throttles (it answers 503 under global load) resumes there next time.
 */
async function download(dir: string, log: (m: string) => void): Promise<Record<string, string>> {
  const partialPath = join(dir, 'israel-partial.json');
  const partial = existsSync(partialPath) ? (JSON.parse(readFileSync(partialPath, 'utf8')) as { page: number; pages: number; out: Record<string, string> }) : null;
  const out: Record<string, string> = partial?.out ?? {};
  let pages = partial?.pages ?? 1;
  if (partial) log(`  Open Food Facts: resuming after page ${partial.page}/${partial.pages}`);
  for (let page = (partial?.page ?? 0) + 1; page <= Math.min(pages, MAX_PAGES); page++) {
    const q = new URLSearchParams({
      countries_tags_en: 'israel', fields: 'code,image_front_url,image_front_small_url',
      page_size: String(PAGE_SIZE), page: String(page), sort_by: 'code',
    });
    let body: SearchPage | null = null;
    for (let attempt = 1; attempt <= 6 && !body; attempt++) {
      await sleep(attempt === 1 ? GAP_MS : 60_000 * attempt); // 429/503: back off hard (2–6 min)
      const res = await fetch(`${SEARCH}?${q}`, { headers: { 'User-Agent': USER_AGENT } }).catch(() => null);
      if (res?.ok) body = (await res.json()) as SearchPage;
      else {
        log(`  Open Food Facts: page ${page} answered ${res?.status ?? 'no response'} (try ${attempt})`);
        if (res && res.status !== 429 && res.status >= 400 && res.status < 500) throw new Error(`HTTP ${res.status} on page ${page}`);
      }
    }
    if (!body) throw new Error(`page ${page} failed after retries`);
    pages = Math.ceil((body.count ?? 0) / PAGE_SIZE);
    for (const p of body.products ?? []) {
      const url = p.image_front_url ?? p.image_front_small_url;
      if (p.code && /^\d{8,14}$/.test(p.code) && url?.startsWith('https://')) out[p.code.replace(/^0+(?=\d{13}$)/, '')] = url;
    }
    writeFileSync(partialPath, JSON.stringify({ page, pages, out }));
    if (page % 10 === 0 || page === pages) log(`  Open Food Facts: page ${page}/${pages}, ${Object.keys(out).length} photos`);
  }
  rmSync(partialPath, { force: true });
  return out;
}
