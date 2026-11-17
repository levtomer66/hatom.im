// Fetches Wolt venues for the price ingest (see ../wolt.ts for the source and
// why it exists). Every response is cached under raw/wolt/ and a file we
// already have is never fetched again, so one venue is downloaded at most once
// per day; the ingest prunes the raw dir after 7 days.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CanonItem } from '../normalize.ts';
import { leafCategorySlugs, woltItems, type WoltCategory, type WoltItem } from '../wolt.ts';
import type { Throttle } from './sources.ts';

const API = 'https://consumer-api.wolt.com';
// The consumer API answers browsers; a bare client gets the same JSON, but say who we are in the UA comment.
const USER_AGENT = 'Mozilla/5.0 (compatible; hatom-shopping-ingest/0.1)';
/** A runaway pagination guard: the largest category seen has one page. */
const MAX_PAGES = 20;

/** One venue to fetch, from places/wolt.json in the cache dir. */
export interface WoltVenueConfig {
  /** The venue sells only part of the shop (e.g. produce): keep the manual shop listed as well. */
  manualToo?: boolean;
  slug: string;
  /** Target city id (cities.ts). */
  cityId: string;
  /** Discovery place id the venue was approved from; places it for the pin filter. */
  placeId?: string;
}

export interface WoltVenue {
  slug: string;
  name: string;
  address: string;
  items: CanonItem[];
  /** Responses fetched from the network this run (the rest came from the cache). */
  fetched: number;
}

interface StaticPage { venue?: { name?: string; address?: string } }
interface Assortment { categories?: WoltCategory[] }
interface CategoryPage { items?: WoltItem[]; metadata?: { next_page_token?: string | null } }

export async function fetchWoltVenue(slug: string, rawDir: string, day: string, throttle: Throttle): Promise<WoltVenue> {
  let fetched = 0;
  const get = async <T,>(cacheName: string, path: string): Promise<T> => {
    const file = join(rawDir, `${slug}-${day}-${cacheName}.json`);
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as T;
    const body = await throttle.run(async () => {
      const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Wolt ${res.status} for ${path}`);
      return res.text();
    });
    fetched++;
    writeFileSync(file, body);
    return JSON.parse(body) as T;
  };

  const page = await get<StaticPage>('venue', `/order-xp/web/v1/pages/venue/slug/${slug}/static`);
  const base = `/consumer-api/consumer-assortment/v1/venues/slug/${slug}/assortment`;
  const assortment = await get<Assortment>('assortment', `${base}?language=he`);
  const raw: WoltItem[] = [];
  for (const cat of leafCategorySlugs(assortment.categories ?? [])) {
    let token: string | null = null;
    for (let p = 1; p <= MAX_PAGES; p++) {
      const q = new URLSearchParams({ language: 'he', ...(token ? { page_token: token } : {}) });
      const r: CategoryPage = await get<CategoryPage>(`cat-${cat}-p${p}`, `${base}/categories/slug/${cat}?${q}`);
      raw.push(...(r.items ?? []));
      token = r.metadata?.next_page_token ?? null;
      if (!token) break;
    }
  }
  return {
    slug,
    name: page.venue?.name ?? slug,
    address: page.venue?.address ?? '',
    items: woltItems(slug, raw),
    fetched,
  };
}
