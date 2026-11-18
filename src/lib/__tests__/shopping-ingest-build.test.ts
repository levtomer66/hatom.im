import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CanonItem } from '../shopping/normalize.ts';
import type { BarcodePhoto, StoreState } from '../shopping/snapshot.ts';
import { barcodePhotos, buildSnapshot, sizeReport } from '../shopping/ingest/build.ts';
import { stateStore, type StoreRecord } from '../shopping/ingest/state.ts';

const item = (key: string, priceAgorot: number, over: Partial<CanonItem> = {}): CanonItem => ({
  key, code: key, barcode: !key.includes(':'), name: key, manufacturer: '', unitQty: '', quantity: null, unitOfMeasure: '', weighted: false, priceAgorot, ...over,
});
const RL = 'rami-levy-chain';
const rl = (b: string) => `https://img.rami-levy.co.il/product/${b}/small.jpg`;

test('barcodePhotos: a photo known to exist wins; Rami Levy\'s CDN is guessed last, and never for a checked miss', () => {
  const states: StoreState[] = [
    { k: 1, chainId: RL, storeId: '1', promos: [], items: [item('7290000000011', 1), item('7290000000028', 1), item('7290000000035', 1), item(`${RL}:55`, 1)] },
    { k: 2, chainId: 'other', storeId: '2', promos: [], items: [
      item('7290000000042', 1), // nothing known: assumed on Rami Levy's CDN
      item('7290000000059', 1, { img: 'https://wolt/own.jpg' }), // has its source's own photo: nothing is guessed
      item('7290000000066', 1), // checked on the CDN: a miss
      item('7290000000073', 1), // Open Food Facts has it, a photo-only Wolt venue too
      item('7290000000080', 1), // only the photo-only Wolt venue
      item('123', 1), // not a plain 8–14 digit barcode
    ] },
  ];
  const cached = new Map<string, BarcodePhoto>([
    ['7290000000028', { img: rl('7290000000028'), first: true }], // probed: a hit
    ['7290000000073', { img: 'https://off/73.jpg', by: 'off' }],
  ]);
  const photos = barcodePhotos(states, {
    cached,
    probed: { '7290000000028': '2026-11-01', '7290000000035': '-2026-11-01', '7290000000066': '-2026-11-01' },
    wolt: new Map([['7290000000073', 'https://wolt/73.jpg'], ['7290000000080', 'https://wolt/80.jpg'], ['7290000000011', 'https://wolt/11.jpg']]),
    ramiLevyChainId: RL,
  });
  assert.equal(photos, cached);
  assert.deepEqual(Object.fromEntries(photos), {
    '7290000000011': { img: rl('7290000000011'), first: true }, // Rami Levy sells it: its CDN, ahead of Wolt's photo
    '7290000000028': { img: rl('7290000000028'), first: true },
    '7290000000073': { img: 'https://wolt/73.jpg' }, // a Wolt photo beats Open Food Facts
    '7290000000080': { img: 'https://wolt/80.jpg' },
    '7290000000042': { img: rl('7290000000042') },
  });
});

const rec = (chainId: string, id: string, over: Partial<StoreRecord> = {}): StoreRecord => ({
  chainId, storeId: id, subChainId: '', name: `store ${id}`, address: 'ביאליק 1', city: '0', kind: 'physical',
  chainSlug: 'yohananof', chainName: 'יוחננוף', cityId: 'tel-aviv', ...over,
});

test('buildSnapshot: the kept stores\' saved state becomes the docs; loc is the record\'s point', () => {
  const root = mkdtempSync(join(tmpdir(), 'hatom-build-'));
  const paths = { storeState: join(root, 'state', 'stores'), raw: join(root, 'raw') };
  mkdirSync(paths.storeState, { recursive: true });
  mkdirSync(join(root, 'photos'));
  writeFileSync(join(root, 'photos', 'off.json'), JSON.stringify({ at: '2026-11-01', photos: { '7290000000011': 'https://off/11.jpg' } }));
  const state = stateStore(paths, () => {});
  state.save({ chainId: 'A', storeId: '1', priceFile: 'PriceFull7290803800003-000-001-20261115-004031.gz', promoFile: null, items: [item('7290000000011', 500, { name: 'חלב 3%' }), item('A:9', 300)], promos: [] });
  state.save({ chainId: 'A', storeId: '2', priceFile: null, promoFile: null, items: [item('7290000000011', 450, { name: 'חלב 3%' })], promos: [] });
  const stores = [
    rec('A', '1', { at: { lat: 32.0812345, lng: 34.7812345 } }),
    rec('A', '2', { kind: 'online', cityId: null }),
    rec('A', '3'), // kept, but nothing saved yet: a store doc with no prices, no items
  ];
  const lines: string[] = [];
  const snap = buildSnapshot({ stores, keys: { 'A:1': 4, 'A:2': 7, 'A:3': 9 }, state, cacheDir: root, woltPhotos: new Map(), nowLocal: '2026-11-18T12:00', log: (m) => lines.push(m) });

  assert.deepEqual([...snap.stores.keys()], ['A:1', 'A:2', 'A:3']);
  assert.deepEqual(snap.stores.get('A:1')!.loc, { lat: 32.08123, lng: 34.78123 });
  assert.equal(snap.stores.get('A:1')!.pricesAt, '2026-11-15T00:40');
  assert.equal(snap.stores.get('A:2')!.loc, null);
  assert.equal(snap.stores.get('A:3')!.priceFile, null);
  assert.deepEqual(snap.items.get('7290000000011')!.p, { '4': 500, '7': 450 });
  assert.equal(snap.items.get('7290000000011')!.d, 'dairy');
  assert.equal(snap.items.get('7290000000011')!.img, 'https://off/11.jpg');
  assert.equal(snap.items.get('7290000000011')!.imgBy, 'off');
  assert.deepEqual(snap.items.get('A:9')!.p, { '4': 300 });
  assert.ok(snap.chains.get('7290803800003')); // every chain we know, stores or not
  assert.equal(snap.chains.get('wolt')!.name, 'וולט');
  assert.equal(snap.droppedCoupons, 0);
  assert.match(lines[0], /^photos by barcode: 1 /);
  assert.match(lines[1], /^nutrition: 0 items/);

  const report = sizeReport(snap, (doc) => JSON.stringify(doc).length);
  assert.match(report[0], /^snapshot: 3 stores, 2 items \(3 store prices\), 0 live promos \(0 promo-item links\); dropped 0 store copies/);
  assert.match(report[1], /^ {2}BSON: items 0\.0 MB, promos 0\.0 MB, stores 0\.0 MB$/);
  assert.equal(report.length, 3);
});
