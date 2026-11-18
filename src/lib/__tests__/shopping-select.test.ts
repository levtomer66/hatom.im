import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepOnlineStore, type ChainConfig } from '../shopping/chains.ts';
import type { Pin } from '../shopping/places.ts';
import type { Locator } from '../shopping/ingest/locate.ts';
import { makePicks, type PicksData, type Point, type ReviewRow } from '../shopping/ingest/picks.ts';
import {
  describeKept, fallbackOrder, keepFallbacks, keepRule, needsFallback, selector, woltVenueRule,
  type FallbackCandidate, type SelectableStore,
} from '../shopping/ingest/select.ts';

const ctx = { pinnedCities: new Set(['tel-aviv']), curated: new Set(['yohananof/7']), skipped: new Set(['yohananof/9']) };

test('keepRule: a curated store is kept in a city with no pin', () => {
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/7', cityId: 'beer-sheva' }, ctx), 'keep');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'beer-sheva' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/9', cityId: 'tel-aviv' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'tel-aviv' }, ctx), 'locate');
});

test('keepRule: an online store is kept exactly when keepOnlineStore says so', () => {
  const chain = { slug: 'x', chainId: '1', name: 'x', source: { kind: 'shufersal' }, onlineStores: ['413'] } satisfies ChainConfig;
  for (const storeId of ['413', '7']) {
    for (const cityId of [null, 'tel-aviv', 'holon']) {
      const listedOnline = chain.onlineStores.includes(storeId);
      assert.equal(
        keepRule({ kind: 'online', key: `x/${storeId}`, cityId, listedOnline }, ctx),
        keepOnlineStore(chain, storeId, cityId) ? 'keep' : 'drop',
        `${storeId} in ${cityId}`,
      );
    }
  }
  // A pickup point in a target city is kept with or without a pin there; curation and skips don't apply.
  assert.equal(keepRule({ kind: 'online', key: 'yohananof/9', cityId: 'beer-sheva' }, ctx), 'keep');
  assert.equal(keepRule({ kind: 'online', key: 'yohananof/7', cityId: null }, ctx), 'drop');
});

// ── a chain with no store near a pin keeps one (its only store) ──────────

const cand = (over: Partial<FallbackCandidate> & { key: string }): FallbackCandidate => ({
  storeId: over.key.split('/')[1], kind: 'physical', listedOnline: false, distM: null, pinnedCity: true, skipped: false, ...over,
});

test('fallbackOrder: a listed online store first, then physical stores nearest a pin', () => {
  const order = fallbackOrder([
    cand({ key: 'osher-ad/13', distM: 3200 }),
    cand({ key: 'osher-ad/24', distM: 2100 }),
    cand({ key: 'osher-ad/150', kind: 'online', listedOnline: true }),
  ]);
  assert.deepEqual(order, ['osher-ad/150', 'osher-ad/24', 'osher-ad/13']);
});

test('fallbackOrder: unlisted online stores and stores the owner skipped are never candidates', () => {
  const order = fallbackOrder([
    cand({ key: 'keshet/116', kind: 'online' }),
    cand({ key: 'keshet/104', distM: 900, skipped: true }),
    cand({ key: 'keshet/18', distM: 4000 }),
  ]);
  assert.deepEqual(order, ['keshet/18']);
});

test('fallbackOrder: stores that cannot be placed come last, a pinned city first, then by store number', () => {
  const order = fallbackOrder([
    cand({ key: 'x/30', pinnedCity: false }),
    cand({ key: 'x/9' }),
    cand({ key: 'x/12' }),
    cand({ key: 'x/5', pinnedCity: false, distM: 40_000 }),
  ]);
  assert.deepEqual(order, ['x/5', 'x/9', 'x/12', 'x/30']);
});

test('keepFallbacks: a saved fallback stays while its chain has no other priced store', () => {
  const stores = [
    { key: 'keshet/104', chainSlug: 'keshet', keptAs: 'fallback' as const, priced: true },
    { key: 'osher-ad/24', chainSlug: 'osher-ad', keptAs: 'fallback' as const, priced: true },
    { key: 'osher-ad/7', chainSlug: 'osher-ad', priced: true }, // a new pin reached it
    { key: 'tiv-taam/3', chainSlug: 'tiv-taam', keptAs: 'fallback' as const, priced: false },
  ];
  const kept = new Set(['osher-ad/7']);
  assert.deepEqual([...keepFallbacks(stores, kept)], ['keshet/104']);
});

test('keepFallbacks: a kept store with no prices does not count as the chain having one', () => {
  const stores = [
    { key: 'yohananof/150', chainSlug: 'yohananof', priced: false }, // online pickup, publishes nothing
    { key: 'yohananof/40', chainSlug: 'yohananof', keptAs: 'fallback' as const, priced: true },
  ];
  assert.deepEqual([...keepFallbacks(stores, new Set(['yohananof/150']))], ['yohananof/40']);
});

test('needsFallback: only a chain whose kept stores have no prices at all, today\'s or saved', () => {
  // Fresh Market 2026-11-18: both Super Yuda stores skipped a day's PriceFull but keep yesterday's prices.
  assert.equal(needsFallback([{ publishesToday: false, savedPrices: true }, { publishesToday: false, savedPrices: true }]), false);
  assert.equal(needsFallback([{ publishesToday: true, savedPrices: false }]), false); // a new store's first file
  assert.equal(needsFallback([{ publishesToday: false, savedPrices: false }]), true); // Yochananof 150: never published
  assert.equal(needsFallback([]), true); // Osher Ad: nothing near a pin
});

// Wolt venues in Jerusalem / Mevaseret (no pin there, by the owner's choice):
// one whose discovery entry the owner included is kept like a curated store.
test('woltVenueRule: an included venue is kept in a city with no pin; pinned cities keep the walk check', () => {
  const pinnedCities = new Set(['tel-aviv']);
  assert.equal(woltVenueRule({ cityId: 'jerusalem', placed: true, included: true }, pinnedCities), 'keep');
  assert.equal(woltVenueRule({ cityId: 'jerusalem', placed: true, included: false }, pinnedCities), 'drop');
  assert.equal(woltVenueRule({ cityId: 'jerusalem', placed: false, included: true }, pinnedCities), 'drop');
  assert.equal(woltVenueRule({ cityId: 'tel-aviv', placed: true, included: true }, pinnedCities), 'locate');
  assert.equal(woltVenueRule({ cityId: 'tel-aviv', placed: false, included: true }, pinnedCities), 'drop');
});

// ── the selection stage: every keep/drop decision, over one Picks and one locator ──

const home: Pin = { id: 'home', label: 'בית', lat: 32.08, lng: 34.78, city: 'tel-aviv', walkMinutes: 12 };
const area: Pin = { id: 'area', label: 'שכונה', lat: 31.25, lng: 34.79, city: 'beer-sheva', radiusM: 800 };

const row = (over: Partial<ReviewRow> & { id: string }): ReviewRow => ({
  name: over.id, names: [over.id], lat: 32.081, lng: 34.781, address: 'ביאליק 1', categories: [], sources: ['google'],
  refs: [over.id], distanceM: 100, status: 'none', retailer: null, official: null, decision: 'pending', ...over,
});
const official = (chainSlug: string, storeId: string) => ({ chainSlug, storeId, name: '', address: '', cityId: null });

const picksOf = (over: Partial<PicksData> = {}) =>
  makePicks({ pins: [home, area], rings: new Map(), reviews: [], decisions: {}, handMatches: {}, woltVenues: [], ...over });

const st = (chainSlug: string, id: string, cityId: string | null, over: Partial<SelectableStore> = {}): SelectableStore => ({
  chainId: `c-${chainSlug}`, storeId: id, chainSlug, chainName: chainSlug, name: `${chainSlug} ${id}`, address: 'הרצל 1', kind: 'physical', cityId, ...over,
});

/** Stores are placed from a table keyed "<chainSlug>/<storeId>"; a point is near a pin when its lat is under 32.09 / 31.26. */
function fakeLocator(points: Record<string, Point | null | 'uncached'>, near: (cityId: string | null, at: Point) => boolean | 'uncached' = (_c, at) => at.lat < (at.lat > 32 ? 32.09 : 31.26)) {
  const asked: string[] = [];
  const locator: Locator = {
    pointOf: async (s) => {
      asked.push(`${s.chainSlug}/${s.storeId}`);
      const p = points[`${s.chainSlug}/${s.storeId}`];
      return p === undefined ? null : p;
    },
    queriesOf: () => ['הרצל 1 תל אביב'],
    near: async (cityId, at) => near(cityId, at),
    nearestPinM: (at) => Math.round(Math.abs(at.lat - 32.08) * 111_000),
  };
  return { locator, asked };
}

const chains = (slug: string): ChainConfig | undefined =>
  slug === 'shufersal' ? { slug, chainId: 'c-shufersal', name: 'שופרסל', source: { kind: 'shufersal' }, onlineStores: ['413'] } : undefined;

test('selectOfficial: each store is kept or dropped once, with the reason and its point', async () => {
  const picks = picksOf({
    reviews: [{
      pin: home,
      rows: [
        row({ id: 'G:included', official: official('yohananof', '7'), lat: 32.2, lng: 34.9 }),
        row({ id: 'G:far-included', lat: 32.0037, lng: 34.804 }),
        row({ id: 'G:skipped', official: official('yohananof', '9') }),
      ],
    }],
    decisions: { 'G:included': 'include', 'G:far-included': 'include', 'G:skipped': 'skip' },
    handMatches: { 'G:far-included': 'hazi-hinam/204' },
  });
  const { locator, asked } = fakeLocator({
    'yohananof/1': { lat: 32.085, lng: 34.78 }, // near the home pin
    'yohananof/2': { lat: 32.2, lng: 34.9 }, // outside it
    'yohananof/3': null, // can't be placed, under a walk pin
    'yohananof/5': null, // can't be placed, under an area pin
  });
  const stores = [
    st('yohananof', '7', 'tel-aviv'),
    st('hazi-hinam', '204', 'holon'), // a city with no pin: only because the owner included it
    st('yohananof', '1', 'tel-aviv'),
    st('yohananof', '2', 'tel-aviv'),
    st('yohananof', '9', 'tel-aviv'),
    st('yohananof', '3', 'tel-aviv'),
    st('yohananof', '5', 'beer-sheva'),
    st('yohananof', '6', 'holon'), // a city with no pin
    st('yohananof', '8', null), // not in a target city
    st('shufersal', '413', null, { kind: 'online' }), // on the chain's list
    st('shufersal', '500', null, { kind: 'online' }),
    st('shufersal', '501', 'tel-aviv', { kind: 'online' }), // a pickup point in a target city
  ];
  const sel = await selector(picks, locator, chains).selectOfficial(stores);

  assert.deepEqual(sel.kept.map((k) => [`${k.store.chainSlug}/${k.store.storeId}`, k.reason, k.store.at ?? null]), [
    ['yohananof/7', 'included', { lat: 32.2, lng: 34.9 }], // the review row's point; never re-checked against the walk
    ['hazi-hinam/204', 'included', { lat: 32.0037, lng: 34.804 }],
    ['yohananof/1', 'near-pin', { lat: 32.085, lng: 34.78 }],
    ['yohananof/5', 'unplaced', null], // an area pin sets no walk limit to break
    ['shufersal/413', 'online', null],
    ['shufersal/501', 'online', null],
  ]);
  assert.deepEqual(sel.dropped.map((d) => [`${d.store.chainSlug}/${d.store.storeId}`, d.reason]), [
    ['yohananof/2', 'outside'],
    ['yohananof/9', 'skipped'],
    ['yohananof/3', 'unplaced'], // can't be shown to be within the walk
    ['yohananof/6', 'no-pin'],
    ['yohananof/8', 'no-city'],
    ['shufersal/500', 'online-unlisted'],
  ]);
  // Only the stores whose verdict depends on where they are were placed.
  assert.deepEqual(asked, ['yohananof/1', 'yohananof/2', 'yohananof/3', 'yohananof/5']);
  // The unplaced ones say what was tried, for the log.
  assert.match(sel.dropped[2].note!, /can't place it \(tried "הרצל 1 תל אביב"\); left out/);
  assert.match(sel.kept[3].note!, /can't place it .*; kept/);
  assert.equal(describeKept(sel.kept), '2 included, 1 near a pin, 1 not placed, 2 online');
});

test('selectOfficial: the point is derived again, never taken from the saved record', async () => {
  const { locator } = fakeLocator({ 'yohananof/1': { lat: 32.085, lng: 34.78 }, 'yohananof/5': null });
  const sel = await selector(picksOf(), locator, chains).selectOfficial([
    st('yohananof', '1', 'tel-aviv', { at: { lat: 1, lng: 1 } }), // a corrected review row / geocode moves the store
    st('yohananof', '5', 'beer-sheva', { at: { lat: 2, lng: 2 } }),
  ]);
  assert.deepEqual(sel.kept.map((k) => k.store.at), [{ lat: 32.085, lng: 34.78 }, undefined]);
  assert.equal('at' in sel.kept[1].store, false);
});

test('selectOfficial: a lookup that is not cached (an offline run) never drops a store', async () => {
  const { locator } = fakeLocator(
    { 'yohananof/1': 'uncached', 'yohananof/2': { lat: 32.085, lng: 34.78 } },
    () => 'uncached', // the walk from the pin was never routed
  );
  const sel = await selector(picksOf(), locator, chains).selectOfficial([st('yohananof', '1', 'tel-aviv'), st('yohananof', '2', 'tel-aviv')]);
  assert.deepEqual(sel.dropped, []);
  assert.deepEqual(sel.kept.map((k) => [k.store.storeId, k.reason, k.store.at ?? null]), [
    ['1', 'uncached', null],
    ['2', 'uncached', { lat: 32.085, lng: 34.78 }],
  ]);
  assert.match(sel.kept[0].note!, /not in the cache/);
});

test('selectSaved: saved stores are selected again; a fallback stays while its chain has no other priced store', async () => {
  const { locator } = fakeLocator({
    'keshet/104': { lat: 32.3, lng: 34.9 }, // outside the pin
    'osher-ad/24': { lat: 32.4, lng: 34.9 },
    'osher-ad/7': { lat: 32.085, lng: 34.78 }, // a new pin reached it
    'yohananof/2': { lat: 32.2, lng: 34.9 }, // the pin moved away
    'tiv-taam/3': { lat: 32.5, lng: 34.9 },
  });
  const saved = [
    st('keshet', '104', 'ramat-gan', { keptAs: 'fallback' }), // a city with no pin
    st('osher-ad', '24', 'tel-aviv', { keptAs: 'fallback' }),
    st('osher-ad', '7', 'tel-aviv'),
    st('yohananof', '2', 'tel-aviv'),
    st('tiv-taam', '3', 'tel-aviv', { keptAs: 'fallback' }), // never got prices
    st('shufersal', '500', null, { kind: 'online', keptAs: 'fallback' }), // no longer on the chain's online list
  ];
  const priced = (s: SelectableStore) => s.chainSlug !== 'tiv-taam';
  const sel = await selector(picksOf(), locator, chains).selectSaved(saved, priced);
  assert.deepEqual(sel.kept.map((k) => [`${k.store.chainSlug}/${k.store.storeId}`, k.reason, k.store.at ?? null]), [
    ['keshet/104', 'fallback', { lat: 32.3, lng: 34.9 }], // placed although its city has no pin: the app sorts by distance
    ['osher-ad/7', 'near-pin', { lat: 32.085, lng: 34.78 }],
  ]);
  assert.deepEqual(sel.dropped.map((d) => [`${d.store.chainSlug}/${d.store.storeId}`, d.reason]), [
    ['osher-ad/24', 'outside'],
    ['yohananof/2', 'outside'],
    ['tiv-taam/3', 'outside'],
    ['shufersal/500', 'online-unlisted'],
  ]);
  assert.equal(sel.kept[0].store.keptAs, 'fallback');
});

test('fallbackCandidates: the dropped stores of a chain, placed and measured from the nearest pin', async () => {
  const picks = picksOf({
    reviews: [{ pin: home, rows: [row({ id: 'G:no', official: official('keshet', '104') })] }],
    decisions: { 'G:no': 'skip' },
  });
  const { locator } = fakeLocator({ 'keshet/18': { lat: 32.18, lng: 34.9 }, 'keshet/30': { lat: 32.28, lng: 34.9 }, 'keshet/104': { lat: 32.081, lng: 34.781 } });
  const sel = selector(picks, locator, chains);
  const { dropped } = await sel.selectOfficial([
    st('keshet', '104', 'tel-aviv'), // the owner said no
    st('keshet', '18', 'tel-aviv'), // outside the pin
    st('keshet', '30', 'ramat-gan'), // a city with no pin
    st('keshet', '31', 'ramat-gan'), // can't be placed
    st('keshet', '116', null, { kind: 'online' }), // an unlisted online store is no candidate
    st('keshet', '40', null), // nor is a store outside the target cities
  ]);
  const cands = await sel.fallbackCandidates(dropped);
  assert.deepEqual(cands.map((c) => c.cand), [
    { key: 'keshet/104', storeId: '104', kind: 'physical', listedOnline: false, distM: 111, pinnedCity: true, skipped: true },
    { key: 'keshet/18', storeId: '18', kind: 'physical', listedOnline: false, distM: 11_100, pinnedCity: true, skipped: false },
    { key: 'keshet/30', storeId: '30', kind: 'physical', listedOnline: false, distM: 22_200, pinnedCity: false, skipped: false },
    { key: 'keshet/31', storeId: '31', kind: 'physical', listedOnline: false, distM: null, pinnedCity: false, skipped: false },
  ]);
  assert.deepEqual(fallbackOrder(cands.map((c) => c.cand)), ['keshet/18', 'keshet/30', 'keshet/31']);
  // The store the ingest then keeps carries its point.
  assert.deepEqual(cands[1].store.at, { lat: 32.18, lng: 34.9 });
  assert.equal('at' in cands[3].store, false);
});

test('selectWolt: priced venues placed by their discovery entry; the pin\'s walk in a pinned city, the review elsewhere', async () => {
  const picks = picksOf({
    reviews: [{
      pin: home,
      rows: [
        row({ id: 'G:near', lat: 32.085, lng: 34.78 }),
        row({ id: 'G:far', lat: 32.3, lng: 34.9 }),
        row({ id: 'A:jlm', city: 'jerusalem', lat: 31.78, lng: 35.19 }),
        row({ id: 'A:jlm-pending', city: 'jerusalem', lat: 31.77, lng: 35.2 }),
      ],
    }],
    decisions: { 'A:jlm': 'include', 'G:far': 'include' },
    woltVenues: [
      { slug: 'near', cityId: 'tel-aviv', placeId: 'G:near' },
      { slug: 'far', cityId: 'tel-aviv', placeId: 'G:far' },
      { slug: 'jlm', cityId: 'jerusalem', placeId: 'A:jlm' },
      { slug: 'jlm-pending', cityId: 'jerusalem', placeId: 'A:jlm-pending' },
      { slug: 'unplaced', cityId: 'tel-aviv' },
      { slug: 'photos', cityId: 'tel-aviv', placeId: 'G:near', photosOnly: true },
      { slug: 'elsewhere', cityId: 'haifa', placeId: 'G:near' },
    ],
  });
  const sel = await selector(picks, fakeLocator({}).locator, chains).selectWolt();
  assert.deepEqual(sel.kept.map((k) => [k.venue.slug, k.at]), [
    ['near', { lat: 32.085, lng: 34.78 }],
    ['jlm', { lat: 31.78, lng: 35.19 }],
  ]);
  assert.deepEqual(sel.dropped.map((d) => [d.venue.slug, d.why]), [
    ['far', 'outside the pin'],
    ['jlm-pending', 'not included in the review'],
    ['unplaced', 'no discovery entry to place it'],
  ]);
});

test('selectManual: the included shops with no price source, from the picks', () => {
  const picks = picksOf({ reviews: [{ pin: home, rows: [row({ id: 'G:makolet' })] }], decisions: { 'G:makolet': 'include' } });
  const shops = selector(picks, fakeLocator({}).locator, chains).selectManual();
  assert.deepEqual(shops.map((s) => [s.name, s.city, s.at]), [['G:makolet', 'tel-aviv', { lat: 32.081, lng: 34.781 }]]);
});
