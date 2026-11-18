import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pin } from '../shopping/places.ts';
import { curation, loadPicks, makePicks, type PicksData, type ReviewRow } from '../shopping/ingest/picks.ts';

test('curation: every hand-match on an included row is curated, at the row point', () => {
  // Discovery merges two entries for one address (a store and its produce store)
  // into one row that names one official store; places/official.json names both.
  const rows = [
    { lat: 32.0037, lng: 34.804, refs: ['A:store', 'A:produce'], official: { chainSlug: 'hazi-hinam', storeId: '204' } },
    { lat: 31.24, lng: 34.81, refs: ['N1'], official: { chainSlug: 'yohananof', storeId: '54' } },
    { lat: 31.3, lng: 34.8, refs: ['N2'], official: null },
  ];
  const decisions = { 'A:store': 'include', 'A:produce': 'include', N1: 'skip', N2: 'include' };
  const hand = { 'A:store': 'hazi-hinam/204', 'A:produce': 'hazi-hinam/217', N2: 'yohananof/40' };
  const c = curation(rows, decisions, hand);
  assert.deepEqual([...c.curated].sort(), ['hazi-hinam/204', 'hazi-hinam/217', 'yohananof/40']);
  assert.deepEqual([...c.skipped], ['yohananof/54']);
  assert.deepEqual(c.matched.get('hazi-hinam/217'), { lat: 32.0037, lng: 34.804 });
  assert.deepEqual(c.matched.get('yohananof/40'), { lat: 31.3, lng: 34.8 });
});

test('curation: a store included on one row and skipped on another stays curated', () => {
  const rows = [
    { lat: 1, lng: 1, refs: ['a'], official: { chainSlug: 'x', storeId: '1' } },
    { lat: 2, lng: 2, refs: ['b'], official: { chainSlug: 'x', storeId: '1' } },
  ];
  const c = curation(rows, { a: 'skip', b: 'include' }, {});
  assert.deepEqual([...c.curated], ['x/1']);
  assert.equal(c.skipped.size, 0);
});

// ── the owner's files as one object ──────────────────────────────────────

const home: Pin = { id: 'home', label: 'בית', lat: 32.08, lng: 34.78, city: 'tel-aviv', walkMinutes: 12 };
const work: Pin = { id: 'work', label: 'עבודה', lat: 31.25, lng: 34.79, city: 'beer-sheva', radiusM: 800 };

const row = (over: Partial<ReviewRow> & { id: string }): ReviewRow => ({
  name: over.id, names: [over.id], lat: 32.081, lng: 34.781, address: 'ביאליק 1', categories: [], sources: ['google'],
  refs: [over.id], distanceM: 100, status: 'none', retailer: null, official: null, decision: 'pending', ...over,
});

const picksOf = (over: Partial<PicksData>) =>
  makePicks({ pins: [home, work], rings: new Map(), reviews: [], decisions: {}, handMatches: {}, woltVenues: [], ...over });

const shopId = (rowId: string) => createHash('sha1').update(rowId).digest('hex').slice(0, 10);

test('placePoint: a discovery place is where its review row is, under any pin', () => {
  const p = picksOf({
    reviews: [
      { pin: home, rows: [row({ id: 'G:a', refs: ['G:a', 'N7'], lat: 32.1, lng: 34.8 })] },
      { pin: work, rows: [row({ id: 'G:b', lat: 31.2, lng: 34.7 }), row({ id: 'G:c', refs: ['G:a'], lat: 31.3, lng: 34.6 })] },
    ],
  });
  assert.deepEqual(p.placePoint('N7'), { lat: 32.1, lng: 34.8 });
  assert.deepEqual(p.placePoint('G:b'), { lat: 31.2, lng: 34.7 });
  assert.deepEqual(p.placePoint('G:a'), { lat: 31.3, lng: 34.6 }); // listed twice: the later row wins, as before
  assert.equal(p.placePoint('G:nowhere'), undefined);
});

test('manualShops: an included row with no price source, keyed by the hash of its row id', () => {
  const p = picksOf({
    reviews: [{ pin: home, rows: [row({ id: 'G:makolet', name: 'מכולת השכונה', address: 'ביאליק 26', lat: 32.0812, lng: 34.7813 })] }],
    decisions: { 'G:makolet': 'include' },
  });
  assert.deepEqual(p.manualShops(), [
    { id: shopId('G:makolet'), name: 'מכולת השכונה', address: 'ביאליק 26', city: 'tel-aviv', at: { lat: 32.0812, lng: 34.7813 } },
  ]);
});

test('manualShops: not a row we ingest officially, one the owner did not include, or one sold on Wolt', () => {
  const p = picksOf({
    reviews: [{
      pin: home,
      rows: [
        row({ id: 'G:ingested', status: 'ingested', official: { chainSlug: 'yohananof', storeId: '40', name: '', address: '', cityId: 'tel-aviv' } }),
        row({ id: 'G:pending' }),
        row({ id: 'G:skipped' }),
        row({ id: 'G:wolt', refs: ['G:wolt', 'N9'] }),
        row({ id: 'G:produce' }),
        row({ id: 'G:second-ref', refs: ['N1', 'N2'] }),
      ],
    }],
    decisions: { 'G:ingested': 'include', 'G:skipped': 'skip', 'G:wolt': 'include', 'G:produce': 'include', N2: 'include' },
    woltVenues: [
      { slug: 'the-wolt-shop', cityId: 'tel-aviv', placeId: 'N9' },
      // Sells only its produce on Wolt: the shop stays listed for typed prices too.
      { slug: 'produce-only', cityId: 'tel-aviv', placeId: 'G:produce', manualToo: true },
      { slug: 'no-place', cityId: 'tel-aviv' },
    ],
  });
  assert.deepEqual(p.manualShops().map((s) => s.id), [shopId('G:produce'), shopId('G:second-ref')]);
});

test('manualShops: a shop added under another city\'s pin carries its own city; a city we do not target is left out', () => {
  const p = picksOf({
    reviews: [
      { pin: home, rows: [row({ id: 'A:jlm', city: 'jerusalem' }), row({ id: 'A:haifa', city: 'haifa' })] },
      { pin: work, rows: [row({ id: 'A:bs' }), row({ id: 'A:jlm', city: 'jerusalem', name: 'second listing' })] },
    ],
    decisions: { 'A:jlm': 'include', 'A:haifa': 'include', 'A:bs': 'include' },
  });
  const shops = p.manualShops();
  assert.deepEqual(shops.map((s) => [s.id, s.city]), [[shopId('A:jlm'), 'jerusalem'], [shopId('A:bs'), 'beer-sheva']]);
  assert.equal(shops[0].name, 'second listing'); // one shop per row id; the later listing's details, as before
});

test('picks: the pinned cities and the curation of every pin\'s rows', () => {
  const p = picksOf({
    reviews: [
      { pin: home, rows: [row({ id: 'G:yo', official: { chainSlug: 'yohananof', storeId: '7', name: '', address: '', cityId: 'tel-aviv' }, lat: 32.05, lng: 34.77 })] },
      { pin: work, rows: [row({ id: 'A:hh' }), row({ id: 'G:no', official: { chainSlug: 'keshet', storeId: '104', name: '', address: '', cityId: 'beer-sheva' } })] },
    ],
    decisions: { 'G:yo': 'include', 'A:hh': 'include', 'G:no': 'skip' },
    handMatches: { 'A:hh': 'hazi-hinam/204' },
  });
  assert.deepEqual([...p.pinnedCities].sort(), ['beer-sheva', 'tel-aviv']);
  const c = p.curation();
  assert.deepEqual([...c.curated].sort(), ['hazi-hinam/204', 'yohananof/7']);
  assert.deepEqual([...c.skipped], ['keshet/104']);
  assert.deepEqual(c.matched.get('yohananof/7'), { lat: 32.05, lng: 34.77 });
  assert.equal(p.curation(), c); // derived once
  assert.equal(p.included('G:yo'), true);
  assert.equal(p.included('G:no'), false);
});

test('loadPicks: reads the owner\'s files from places/, missing ones as empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hatom-picks-'));
  const area: Pin = { id: 'area', label: 'שכונה', lat: 31.25, lng: 34.79, city: 'beer-sheva', osmArea: 'W1' };
  writeFileSync(join(dir, 'pins.json'), JSON.stringify([home, area, { ...work, osmArea: 'W404' }]));
  writeFileSync(join(dir, 'W1.geojson'), JSON.stringify({ type: 'Polygon', coordinates: [[[34.7, 31.2], [34.9, 31.2], [34.9, 31.3], [34.7, 31.2]]] }));
  writeFileSync(join(dir, 'home.review.json'), JSON.stringify([row({ id: 'G:a' })]));
  writeFileSync(join(dir, 'decisions.json'), JSON.stringify({ 'G:a': 'include' }));
  writeFileSync(join(dir, 'official.json'), JSON.stringify({ 'G:a': 'yohananof/7' }));
  writeFileSync(join(dir, 'wolt.json'), JSON.stringify([{ slug: 'v', cityId: 'tel-aviv' }]));
  const p = loadPicks(dir);
  assert.deepEqual(p.pins.map((x) => x.id), ['home', 'area', 'work']);
  assert.deepEqual(p.reviews.map((r) => [r.pin.id, r.rows.length]), [['home', 1], ['area', 0], ['work', 0]]);
  assert.deepEqual(p.rings.get('area'), [[34.7, 31.2], [34.9, 31.2], [34.9, 31.3], [34.7, 31.2]]);
  assert.equal(p.rings.get('work'), null); // the outline file is missing
  assert.equal(p.rings.has('home'), false); // not an area pin
  assert.deepEqual(p.decisions, { 'G:a': 'include' });
  assert.deepEqual(p.handMatches, { 'G:a': 'yohananof/7' });
  assert.deepEqual(p.woltVenues, [{ slug: 'v', cityId: 'tel-aviv' }]);
  assert.deepEqual([...p.curation().curated], ['yohananof/7']);
});

test('loadPicks: no pins is an error that says how to fix it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hatom-picks-'));
  assert.throws(() => loadPicks(dir), new RegExp(`no pins: create ${join(dir, 'pins.json').replace(/[.\\/]/g, '\\$&')}`));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pins.json'), '[]');
  assert.throws(() => loadPicks(dir), /no pins/);
});
