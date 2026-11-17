import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dealGap, distanceLabel, endsLabel, groupHere, isTwin, storeDeals, HERE_WORTH_WALK, mergeLists, metresBetween, nearbyStore, sortStores, tieOf, verdict,
  type HereRow, type HereStore,
} from '../shopping/here.ts';
import type { PromoDoc } from '../shopping/snapshot.ts';
import type { PricedItem } from '../shopping/pricing.ts';

test('verdict: not sold here', () => {
  assert.deepEqual(verdict(null, 500), { group: 'missing', saving: 0 });
});

test('verdict: cheapest, or nobody else sells it', () => {
  assert.deepEqual(verdict(500, 500), { group: 'best', saving: 0 });
  assert.deepEqual(verdict(500, null), { group: 'best', saving: 0 });
});

test('verdict: within max(₪0.50, 3%) of the cheapest counts as the cheapest', () => {
  assert.equal(tieOf(1000), 50); // 3% = 30 < 50
  assert.equal(tieOf(5000), 150); // 3% of ₪50
  assert.equal(verdict(1050, 1000).group, 'best');
  assert.equal(verdict(1051, 1000).group, 'ok');
  assert.equal(verdict(5150, 5000).group, 'best');
  assert.equal(verdict(5151, 5000).group, 'ok');
});

test('verdict: ₪3 saving on the list quantity is worth the walk', () => {
  assert.deepEqual(verdict(1200, 1000, 1), { group: 'ok', saving: 200 });
  assert.deepEqual(verdict(1200, 1000, 2), { group: 'elsewhere', saving: 400 });
  assert.equal(verdict(1000 + HERE_WORTH_WALK, 1000).group, 'elsewhere');
  // Weighted: 1.5 kg at ₪2/kg more = ₪3
  assert.deepEqual(verdict(1200, 1000, 1.5), { group: 'elsewhere', saving: 300 });
});

const row = (key: string, group: HereRow['group'], saving: number): HereRow =>
  ({ key, qty: 1, listIds: ['l'], here: null, best: null, group, saving });

test('groupHere: groups, biggest saving first, then by key', () => {
  const g = groupHere([row('b', 'ok', 100), row('a', 'ok', 100), row('c', 'ok', 250), row('d', 'best', 0), row('e', 'missing', 0)]);
  assert.deepEqual(g.ok.map((r) => r.key), ['c', 'a', 'b']);
  assert.deepEqual(g.best.map((r) => r.key), ['d']);
  assert.deepEqual(g.elsewhere, []);
  assert.deepEqual(g.missing.map((r) => r.key), ['e']);
});

test('mergeLists: each item once, largest quantity, every list', () => {
  const merged = mergeLists([
    { id: 'a', items: [{ key: 'milk', qty: 2 }, { key: 'eggs', qty: 1 }] },
    { id: 'b', items: [{ key: 'milk', qty: 3 }] },
  ]);
  assert.deepEqual(merged, [
    { key: 'milk', qty: 3, listIds: ['a', 'b'] },
    { key: 'eggs', qty: 1, listIds: ['a'] },
  ]);
});

const store = (k: number, loc: HereStore['loc'], walkMin: number | null, name = `s${k}`, priced = true): HereStore => ({
  k, chainId: 'c', chainName: 'רשת', name, address: '', city: 'tlv', kind: 'physical', pricesAt: null, source: 'official', walkMin, loc, priced,
});

test('metresBetween: about 111 km per degree of latitude', () => {
  const d = metresBetween({ lat: 32, lng: 34.8 }, { lat: 33, lng: 34.8 });
  assert.ok(Math.abs(d - 111_195) < 200, String(d));
});

test('sortStores: by distance, then stores without one by walking time', () => {
  const me = { lat: 32.0853, lng: 34.7818 };
  const near = store(1, { lat: 32.0855, lng: 34.7818 }, 9);
  const far = store(2, { lat: 32.0953, lng: 34.7818 }, 2);
  const noLoc = store(3, null, 1);
  const noLocSlow = store(4, null, 7);
  const sorted = sortStores([noLocSlow, far, noLoc, near], me);
  assert.deepEqual(sorted.map((s) => s.k), [1, 2, 3, 4]);
  assert.ok(sorted[0].distM! < 50);
  assert.equal(sorted[2].distM, null);
});

test('sortStores: without a position, by walking time then name', () => {
  const sorted = sortStores([store(1, null, 5, 'ב'), store(2, null, null, 'א'), store(3, null, 5, 'א')], null);
  assert.deepEqual(sorted.map((s) => s.k), [3, 1, 2]);
});

test('sortStores: stores with prices first, each part by distance', () => {
  const me = { lat: 32.0853, lng: 34.7818 };
  const unpricedNear = store(1, { lat: 32.0854, lng: 34.7818 }, 1, 'x', false);
  const pricedFar = store(2, { lat: 32.0953, lng: 34.7818 }, 9);
  const pricedNear = store(3, { lat: 32.0870, lng: 34.7818 }, 5);
  const unpricedNoLoc = store(4, null, 1, 'y', false);
  assert.deepEqual(sortStores([unpricedNear, pricedFar, unpricedNoLoc, pricedNear], me).map((s) => s.k), [3, 2, 1, 4]);
});

test('nearbyStore: the nearest within 80 m, wherever it sorts', () => {
  assert.equal(nearbyStore([{ distM: 300 }, { distM: 60 }, { distM: 40 }])?.distM, 40);
  assert.equal(nearbyStore([{ distM: 60 }])?.distM, 60);
  assert.equal(nearbyStore([{ distM: 120 }]), null);
  assert.equal(nearbyStore([{ distM: null }]), null);
  assert.equal(nearbyStore([]), null);
});

test('distanceLabel', () => {
  assert.equal(distanceLabel(4), '10 מ׳');
  assert.equal(distanceLabel(123), '120 מ׳');
  assert.equal(distanceLabel(1430), '1.4 ק״מ');
});

test('dealGap: how many more units reach a multi-buy', () => {
  assert.equal(dealGap(3, 2, false), 1);
  assert.equal(dealGap(3, 3, false), null);
  assert.equal(dealGap(1, 1, false), null);
  assert.equal(dealGap(null, 1, false), null);
  assert.equal(dealGap(10, 1, false), null); // more than 5
  assert.equal(dealGap(2, 0.5, true), null); // weighed
});

test('endsLabel: today, tomorrow (across a month), or the date', () => {
  assert.equal(endsLabel('2026-11-17T23:59', '2026-11-17T09:00'), 'נגמר היום');
  assert.equal(endsLabel('2026-12-01T00:00', '2026-11-30T21:00'), 'נגמר מחר');
  assert.equal(endsLabel('2026-11-24T23:59', '2026-11-17T09:00'), 'עד 24.11');
});

test('isTwin: a shared word that is not the brand', () => {
  assert.equal(isTwin('סנו רב מגבת גמבו', 'סנו', 'נוזל לניקוי כלים היפואלרגני סנו'), false);
  assert.equal(isTwin('סנו רב מגבת גמבו', 'סנו', 'מגבת נייר לבנה 6 גלילים'), true);
  assert.equal(isTwin('ריבת תות 340 גרם', 'יכין', 'ריבת תות יכין'), true);
});

const promo = (id: string, items: string[], g: Partial<PromoDoc['g'][number]>, extra: Partial<PromoDoc> = {}): PromoDoc => ({
  _id: id, pid: id, chain: 'c', d: id, s: '2026-11-01T00:00', e: '2026-11-30T23:59', club: 0, clubName: '', coupon: false,
  minAmt: null, limit: null, minItems: null, remarks: '', stores: [7], items,
  g: [{ gid: '1', rt: 1, min: 1, max: null, rate: null, price: null, w: false, items, ...g }],
  ...extra,
});

test('storeDeals: each item once at its best share, biggest first; skips other stores, ended and no-saving deals', () => {
  const items = new Map<string, PricedItem>([
    ['a', { _id: 'a', w: false, p: { '7': 1000 } }],
    ['b', { _id: 'b', w: false, p: { '7': 500 } }],
    ['c', { _id: 'c', w: false, p: { '8': 500 } }],
  ]);
  const deals = storeDeals(7, [
    promo('p1', ['a'], { min: 3, price: 2400 }), // 3 for ₪24 instead of ₪30: 20%
    promo('p2', ['a'], { rate: 10 }), // 10%: worse for a
    promo('p3', ['b'], { rate: 50 }, { club: 3, clubName: 'מועדון' }), // club 50%
    promo('p4', ['c'], { rate: 50 }), // c isn't sold at 7
    promo('p5', ['b'], { rate: 90 }, { e: '2026-11-10T00:00' }), // ended
    promo('p6', ['b'], { price: 600 }), // dearer than the shelf
    promo('p7', ['b'], { min: 2, price: 0, rate: 100 }, { d: 'קופון פיצוי' }), // free: a compensation coupon
  ], items, '2026-11-17T12:00');
  assert.deepEqual(deals.map((d) => [d.key, d.promo, d.qty, d.cost, d.regularCost, d.club]), [
    ['b', 'p3', 1, 250, 500, true],
    ['a', 'p1', 3, 2400, 3000, false],
  ]);
});

test('storeDeals: "קופון" in the description marks a coupon deal', () => {
  const items = new Map<string, PricedItem>([['a', { _id: 'a', w: false, p: { '7': 1000 } }]]);
  const [d] = storeDeals(7, [promo('p1', ['a'], { rate: 20 }, { d: 'קופון 20% הנחה' })], items, '2026-11-17T12:00');
  assert.equal(d.coupon, true);
});
