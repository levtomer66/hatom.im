import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chainBySlug } from '../shopping/chains.ts';
import { parseFileName } from '../shopping/normalize.ts';
import type { Pin } from '../shopping/places.ts';
import type { Locator } from '../shopping/ingest/locate.ts';
import { ingestOfficial, type ChainRun } from '../shopping/ingest/official.ts';
import { makePicks, type PicksData, type Point, type ReviewRow } from '../shopping/ingest/picks.ts';
import { selector } from '../shopping/ingest/select.ts';
import type { RemoteFile, SourceClient } from '../shopping/ingest/sources.ts';
import { stateStore } from '../shopping/ingest/state.ts';

// Real Yochananof files (2026-11-15): the Stores file lists 51 stores, of which
// 32, 35 and 54 are in Tel Aviv, 40 in Beer Sheva, 20 in Jerusalem, 73 in Holon
// and 150 is an online pickup point elsewhere. The price and promo files are
// store 1's, served here under other stores' names.
const FIX = join(import.meta.dirname, 'fixtures', 'shopping', 'yohananof');
const STORES = 'Stores7290803800003-000-20261115-010000.xml.gz';
const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(FIX, name.startsWith('Stores') ? STORES : `${name.startsWith('PriceFull') ? 'PriceFull' : 'PromoFull'}7290803800003-000-001-20261115-004031.gz`)));
const remote = (name: string): RemoteFile => ({ name, info: parseFileName(name)!, ref: name });
const fileOf = (type: 'PriceFull' | 'PromoFull', id: string) => `${type}7290803800003-000-${id.padStart(3, '0')}-20261115-004031.gz`;

/** A chain's site: which stores publish which file, and what a download returns. */
function fakeClient(publishes: { PriceFull: string[]; PromoFull: string[] }, bytes: (name: string) => Uint8Array = fixture) {
  const asked: string[] = [];
  const downloads: string[] = [];
  const client: SourceClient = {
    latestStores: async () => remote(STORES),
    latestFor: async (type, ids) => {
      asked.push(`${type} ${ids.join(',')}`);
      return new Map(ids.filter((id) => publishes[type].includes(id)).map((id) => [id, remote(fileOf(type, id))]));
    },
    download: async (f) => {
      downloads.push(f.name);
      return bytes(f.name);
    },
  };
  return { client, asked, downloads };
}

const home: Pin = { id: 'home', label: 'בית', lat: 32.08, lng: 34.78, city: 'tel-aviv', walkMinutes: 12 };
const row = (over: Partial<ReviewRow> & { id: string }): ReviewRow => ({
  name: over.id, names: [over.id], lat: 31.25, lng: 34.79, address: '', categories: [], sources: ['google'],
  refs: [over.id], distanceM: 100, status: 'none', retailer: null, official: null, decision: 'pending', ...over,
});

/** Places stores from a table; a point is within the pin's walk when its lat is under 32.09. */
const locatorOf = (points: Record<string, Point>): Locator => ({
  pointOf: async (s) => points[s.storeId] ?? null,
  queriesOf: () => ['a query'],
  near: async (_city, at) => at.lat < 32.09,
  nearestPinM: (at) => Math.round(Math.abs(at.lat - 32.08) * 111_000),
});

function job(picks: Partial<PicksData>, points: Record<string, Point>) {
  const root = mkdtempSync(join(tmpdir(), 'hatom-official-'));
  const paths = { storeState: join(root, 'state', 'stores'), raw: join(root, 'raw') };
  mkdirSync(paths.storeState, { recursive: true });
  const lines: string[] = [];
  const warnings: string[] = [];
  const state = stateStore(paths, (m) => lines.push(m));
  const run: ChainRun = {
    rawDir: paths.raw, state, maxStores: null,
    select: selector(makePicks({ pins: [home], rings: new Map(), reviews: [], decisions: {}, handMatches: {}, woltVenues: [], ...picks }), locatorOf(points)),
    log: (m) => lines.push(m), warn: (m) => warnings.push(m),
  };
  return { run, state, paths, lines, warnings };
}

const yohananof = chainBySlug('yohananof')!;

test('ingestOfficial: the chain\'s stores are selected once, then only the kept ones are listed, parsed and saved', async () => {
  const { run, state, paths, lines, warnings } = job(
    {
      reviews: [{ pin: home, rows: [row({ id: 'G:bs', official: { chainSlug: 'yohananof', storeId: '40', name: '', address: '', cityId: 'beer-sheva' } })] }],
      decisions: { 'G:bs': 'include' },
    },
    { '32': { lat: 32.085, lng: 34.78 }, '35': { lat: 32.2, lng: 34.8 } }, // 54 can't be placed
  );
  const site = fakeClient({ PriceFull: ['32', '40', '35'], PromoFull: ['40'] });
  const kept = await ingestOfficial(yohananof, run, site.client);

  assert.deepEqual(kept.map((k) => [k.store.storeId, k.reason, k.store.cityId, k.store.at ?? null]), [
    ['32', 'near-pin', 'tel-aviv', { lat: 32.085, lng: 34.78 }],
    ['40', 'included', 'beer-sheva', { lat: 31.25, lng: 34.79 }], // no pin in Beer Sheva: the owner's pick, at the review's point
  ]);
  assert.equal(kept[0].store.chainSlug, 'yohananof');
  assert.equal(kept[0].store.keptAs, undefined);
  // Listings were asked for the kept stores only, once each; no fallback was looked for.
  assert.deepEqual(site.asked, ['PriceFull 32,40', 'PromoFull 32,40']);
  assert.deepEqual(site.downloads, [STORES, fileOf('PriceFull', '32'), fileOf('PriceFull', '40'), fileOf('PromoFull', '40')]);
  assert.deepEqual(readdirSync(join(paths.raw, 'yohananof')).sort(), [...site.downloads].sort());

  const s32 = state.load(kept[0].store)!;
  const s40 = state.load(kept[1].store)!;
  assert.ok(s32.items.length > 1000);
  assert.equal(s32.priceFile, fileOf('PriceFull', '32'));
  assert.equal(s32.promoFile, null);
  assert.equal(s32.promos.length, 0);
  assert.equal(s40.promoFile, fileOf('PromoFull', '40'));
  assert.ok(s40.promos.length > 100);

  assert.equal(lines[0], `yohananof: 51 stores listed (${STORES}), 6 in target cities or online; kept 2: 1 included, 1 near a pin`);
  assert.ok(warnings.some((w) => /^yohananof store 54 \(.*\): can't place it \(tried "a query"\); left out$/.test(w)));
  assert.ok(warnings.includes('yohananof store 32 (בן צבי תל אביב): no PromoFull listed — keeping previous promos'));

  // The next run, same files on the site: nothing is downloaded or parsed again.
  const again = fakeClient({ PriceFull: ['32', '40'], PromoFull: ['40'] });
  const kept2 = await ingestOfficial(yohananof, run, again.client);
  assert.deepEqual(again.downloads, []);
  assert.deepEqual(kept2.map((k) => k.store.storeId), ['32', '40']);
  assert.equal(state.load(kept2[0].store), s32);
});

test('ingestOfficial: a store that skips a day keeps yesterday\'s prices, and the chain needs no fallback', async () => {
  const { run, state } = job({}, { '32': { lat: 32.085, lng: 34.78 }, '35': { lat: 32.2, lng: 34.8 } });
  await ingestOfficial(yohananof, run, fakeClient({ PriceFull: ['32', '35'], PromoFull: [] }).client);
  const quiet = fakeClient({ PriceFull: ['35'], PromoFull: [] });
  const kept = await ingestOfficial(yohananof, run, quiet.client);
  assert.deepEqual(kept.map((k) => [k.store.storeId, k.reason]), [['32', 'near-pin']]);
  assert.deepEqual(quiet.asked, ['PriceFull 32', 'PromoFull 32']);
  assert.equal(state.load(kept[0].store)!.priceFile, fileOf('PriceFull', '32'));
});

test('ingestOfficial: a chain with no priced store near a pin keeps one — the nearest that publishes a PriceFull', async () => {
  const { run, state, lines } = job({}, {
    '32': { lat: 32.2, lng: 34.8 }, // 13 km from the pin
    '35': { lat: 32.1, lng: 34.8 }, // 2 km
    '40': { lat: 31.25, lng: 34.79 },
    '54': { lat: 32.095, lng: 34.78 }, // nearest, but publishes nothing
  });
  const site = fakeClient({ PriceFull: ['32', '35', '40'], PromoFull: ['35'] });
  const kept = await ingestOfficial(yohananof, run, site.client);
  assert.deepEqual(kept.map((k) => [k.store.storeId, k.reason, k.store.keptAs, k.store.at]), [['35', 'fallback', 'fallback', { lat: 32.1, lng: 34.8 }]]);
  // Nothing was kept, so the candidates were tried nearest first until one published.
  assert.deepEqual(site.asked, ['PriceFull ', 'PriceFull 54', 'PriceFull 35', 'PromoFull 35']);
  assert.ok(state.load(kept[0].store)!.items.length > 1000);
  assert.ok(lines.includes("  35 תל אביב  נחלת יצחק: kept as the chain's only store (2.2 km from the nearest pin)"));
});

test('ingestOfficial: a fallback whose price file cannot be read is not kept; no Stores file fails the chain', async () => {
  const { run, warnings } = job({}, { '35': { lat: 32.1, lng: 34.8 } });
  const broken = fakeClient({ PriceFull: ['35'], PromoFull: [] }, (name) => (name.startsWith('Stores') ? fixture(name) : new Uint8Array(Buffer.from('<Root></Root>'))));
  assert.deepEqual(await ingestOfficial(yohananof, run, broken.client), []);
  assert.ok(warnings.some((w) => /^yohananof store 35: skipped file — .*no items parsed$/.test(w)));
  assert.ok(warnings.includes("yohananof store 35: the chain's only store has no prices — left out"));

  const none = { ...broken.client, latestStores: async () => null };
  await assert.rejects(ingestOfficial(yohananof, run, none), /yohananof: no Stores file listed/);
});

test('ingestOfficial: --max-stores samples the first kept stores', async () => {
  const { run } = job({}, { '32': { lat: 32.085, lng: 34.78 }, '35': { lat: 32.086, lng: 34.78 }, '54': { lat: 32.087, lng: 34.78 } });
  const site = fakeClient({ PriceFull: ['32', '35', '54'], PromoFull: [] });
  const kept = await ingestOfficial(yohananof, { ...run, maxStores: 2 }, site.client);
  assert.deepEqual(kept.map((k) => k.store.storeId), ['32', '35']);
  assert.deepEqual(site.asked, ['PriceFull 32,35', 'PromoFull 32,35']);
});
