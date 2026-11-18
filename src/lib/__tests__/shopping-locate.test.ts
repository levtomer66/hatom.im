import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackOrder, keepFallbacks, keepRule, needsFallback, woltVenueRule, type FallbackCandidate } from '../shopping/ingest/locate.ts';

const ctx = { pinnedCities: new Set(['tel-aviv']), curated: new Set(['yohananof/7']), skipped: new Set(['yohananof/9']) };

test('keepRule: a curated store is kept in a city with no pin', () => {
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/7', cityId: 'beer-sheva' }, ctx), 'keep');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'beer-sheva' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/9', cityId: 'tel-aviv' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'tel-aviv' }, ctx), 'locate');
  assert.equal(keepRule({ kind: 'online', key: 'x/1', cityId: null }, ctx), 'keep');
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
