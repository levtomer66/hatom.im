import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pin } from '../shopping/places.ts';
import type { Locator } from '../shopping/ingest/locate.ts';
import { makePicks, type ReviewRow } from '../shopping/ingest/picks.ts';
import { selector } from '../shopping/ingest/select.ts';
import { Throttle } from '../shopping/ingest/sources.ts';
import { stateStore, type StoreRecord } from '../shopping/ingest/state.ts';
import { fetchWoltVenue, ingestWolt, weekOf, woltPhotos } from '../shopping/ingest/wolt.ts';

const API = 'https://consumer-api.wolt.com';

/** A two-category venue as Wolt's API answers it, by request path. */
const venueApi = (slug: string): Record<string, unknown> => {
  const base = `/consumer-api/consumer-assortment/v1/venues/slug/${slug}/assortment`;
  return {
    [`/order-xp/web/v1/pages/venue/slug/${slug}/static`]: { venue: { name: 'מכולת וולט', address: 'ביאליק 26' } },
    [`${base}?language=he`]: { categories: [{ slug: 'dairy', name: 'מוצרי חלב' }, { slug: 'veg', name: 'ירקות' }] },
    [`${base}/categories/slug/dairy?language=he`]: {
      items: [{ id: 'm1', name: 'חלב 3%', price: 790, barcode_gtin: '07290000000015', images: [{ url: 'https://wolt/milk.jpg' }] }],
      metadata: { next_page_token: 'p2' },
    },
    [`${base}/categories/slug/dairy?language=he&page_token=p2`]: { items: [{ id: 'm2', name: 'קוטג', price: 650 }], metadata: {} },
    [`${base}/categories/slug/veg?language=he`]: { items: [{ id: 'v1', name: 'עגבניה', price: 100, sell_by_weight_config: { price_per_kg: 690 } }] },
  };
};

function fakeWolt(api: Record<string, unknown>) {
  const asked: string[] = [];
  const fetch: typeof globalThis.fetch = async (url) => {
    const path = String(url).slice(API.length);
    asked.push(path);
    return path in api ? Response.json(api[path]) : new Response('no', { status: 404 });
  };
  return { fetch, asked };
}

const tmp = () => mkdtempSync(join(tmpdir(), 'hatom-wolt-'));
const noGap = () => new Throttle(0);

test('fetchWoltVenue: every response is cached per day and never fetched twice', async () => {
  const raw = tmp();
  const net = fakeWolt(venueApi('shop'));
  const first = await fetchWoltVenue('shop', raw, '20261118', noGap(), { fetch: net.fetch });
  assert.equal(first.name, 'מכולת וולט');
  assert.equal(first.fetched, 5);
  assert.deepEqual(first.items.map((i) => [i.key, i.priceAgorot, i.category]), [
    ['7290000000015', 790, 'מוצרי חלב'], ['wolt:shop/m2', 650, 'מוצרי חלב'], ['wolt:shop/v1', 690, 'ירקות'],
  ]);
  assert.equal(readdirSync(raw).length, 5);
  const again = await fetchWoltVenue('shop', raw, '20261118', noGap(), { fetch: net.fetch });
  assert.equal(again.fetched, 0);
  assert.deepEqual(again.items, first.items);
  assert.equal(net.asked.length, 5);
});

test('fetchWoltVenue, offline: reads the cache and makes no request; a response that is not cached is an error', async () => {
  const raw = tmp();
  await fetchWoltVenue('shop', raw, '20261115', noGap(), { fetch: fakeWolt(venueApi('shop')).fetch });
  const net = fakeWolt({});
  const cached = await fetchWoltVenue('shop', raw, '20261115', noGap(), { offline: true, fetch: net.fetch });
  assert.equal(cached.items.length, 3);
  await assert.rejects(fetchWoltVenue('shop', raw, '20261116', noGap(), { offline: true, fetch: net.fetch }), /venue is not cached for 20261116 \(--offline\)/);
  await assert.rejects(fetchWoltVenue('other', raw, '20261115', noGap(), { offline: true, fetch: net.fetch }), /not cached/);
  assert.deepEqual(net.asked, []);
});

test('weekOf: the Sunday of the week, so a photo-only venue is downloaded at most once a week', () => {
  assert.equal(weekOf('2026-11-18T12:00'), '20261115'); // a Wednesday
  assert.equal(weekOf('2026-11-15T00:05'), '20261115'); // the Sunday itself
  assert.equal(weekOf('2026-11-21T23:59'), '20261115'); // Saturday night
  assert.equal(weekOf('2026-11-22T00:00'), '20261122');
});

test('woltPhotos: barcode → photo from the photo-only venues; offline it reads the week\'s cache or skips, with no request', async () => {
  const rawDir = tmp();
  const venues = [{ slug: 'market', cityId: 'tel-aviv', photosOnly: true }, { slug: 'priced', cityId: 'tel-aviv' }];
  const quiet = { log: () => {}, warn: (m: string) => assert.fail(m) };
  const net = fakeWolt(venueApi('market'));
  const online = await woltPhotos(venues, { rawDir, offline: false, nowLocal: '2026-11-18T12:00', fetch: net.fetch, ...quiet });
  assert.deepEqual([...online], [['7290000000015', 'https://wolt/milk.jpg']]); // only items with a barcode and a photo
  assert.ok(net.asked.every((p) => p.includes('/market/')));

  const none = fakeWolt({});
  const lines: string[] = [];
  const sameWeek = await woltPhotos(venues, { rawDir, offline: true, nowLocal: '2026-11-20T09:00', fetch: none.fetch, ...quiet });
  assert.deepEqual([...sameWeek], [...online]);
  const nextWeek = await woltPhotos(venues, { rawDir, offline: true, nowLocal: '2026-11-23T09:00', fetch: none.fetch, warn: quiet.warn, log: (m) => lines.push(m) });
  assert.equal(nextWeek.size, 0);
  assert.deepEqual(lines, ['  market: photos not cached for week 20261122 — skipped (--offline)']);
  assert.deepEqual(none.asked, []);
});

// ── the Wolt run ─────────────────────────────────────────────────────────

const home: Pin = { id: 'home', label: 'בית', lat: 32.08, lng: 34.78, city: 'tel-aviv', walkMinutes: 12 };
const row = (id: string, lat: number, lng: number): ReviewRow => ({
  id, name: id, names: [id], lat, lng, address: '', categories: [], sources: ['google'], refs: [id], distanceM: 100,
  status: 'none', retailer: null, official: null, decision: 'pending',
});
const nearAll: Locator = { pointOf: async () => null, queriesOf: () => [], near: async () => true, nearestPinM: () => 0 };

test('ingestWolt: a selected venue becomes a store at its discovery point; one that fails keeps its previous items and name', async () => {
  const root = tmp();
  const paths = { storeState: join(root, 'state', 'stores'), raw: join(root, 'raw') };
  mkdirSync(paths.storeState, { recursive: true });
  const state = stateStore(paths, () => {});
  const picks = makePicks({
    pins: [home], rings: new Map(), decisions: {}, handMatches: {},
    reviews: [{ pin: home, rows: [row('G:shop', 32.081, 34.781), row('G:down', 32.082, 34.782)] }],
    woltVenues: [{ slug: 'shop', cityId: 'tel-aviv', placeId: 'G:shop' }, { slug: 'down', cityId: 'tel-aviv', placeId: 'G:down' }, { slug: 'unplaced', cityId: 'tel-aviv' }],
  });
  const chain = { slug: 'wolt', chainId: 'wolt', name: 'וולט', source: { kind: 'wolt' as const } };
  const downBefore: StoreRecord = { chainId: 'wolt', storeId: 'down', subChainId: '', name: 'השם הקודם', address: 'הרצל 5', city: 'tel-aviv', kind: 'physical', chainSlug: 'wolt', chainName: 'וולט', cityId: 'tel-aviv' };
  state.save({ chainId: 'wolt', storeId: 'down', priceFile: 'wolt-down-202611170900', promoFile: null, items: [{ key: 'wolt:down/x', code: 'down/x', barcode: false, name: 'x', manufacturer: '', unitQty: '', quantity: null, unitOfMeasure: '', weighted: false, priceAgorot: 100 }], promos: [] });
  const lines: string[] = [];
  const warnings: string[] = [];
  const run = {
    rawDir: paths.raw, state, select: selector(picks, nearAll), saved: { 'wolt:down': downBefore }, maxStores: null,
    log: (m: string) => lines.push(m), warn: (m: string) => warnings.push(m), nowLocal: '2026-11-18T12:34', fetch: fakeWolt(venueApi('shop')).fetch,
  };
  const out = await ingestWolt(chain, run);

  assert.deepEqual(out.map((s) => [s.storeId, s.name, s.address, s.at]), [
    ['shop', 'מכולת וולט', 'ביאליק 26', { lat: 32.081, lng: 34.781 }],
    ['down', 'השם הקודם', 'הרצל 5', { lat: 32.082, lng: 34.782 }],
  ]);
  assert.equal(state.load(out[0])!.priceFile, 'wolt-shop-202611181234');
  assert.equal(state.load(out[0])!.items.length, 3);
  assert.equal(state.load(out[1])!.priceFile, 'wolt-down-202611170900');
  assert.equal(state.load(out[1])!.items.length, 1);
  assert.deepEqual(lines.slice(0, 2), ['  unplaced: no discovery entry to place it — left out', 'wolt: 2 venues in target cities (places/wolt.json)']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^wolt venue down: Wolt 404 .* — keeping previous items$/);

  // Later the same day: the same cached responses, so the price stamp does not move.
  const again = await ingestWolt(chain, { ...run, nowLocal: '2026-11-18T18:00', fetch: fakeWolt({}).fetch });
  assert.equal(state.load(again[0])!.priceFile, 'wolt-shop-202611181234');
});
