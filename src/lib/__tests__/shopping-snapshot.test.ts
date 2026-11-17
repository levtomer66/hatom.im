import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonItem, CanonPromo } from '../shopping/normalize.ts';
import {
  buildItemDocs,
  buildPromoDocs,
  buildStoreDocs,
  diffDocs,
  docHash,
  israelLocalNow,
  type StoreState,
} from '../shopping/snapshot.ts';

const item = (key: string, priceAgorot: number, name = key): CanonItem => ({
  key,
  code: key,
  barcode: !key.includes(':'),
  name,
  manufacturer: '',
  unitQty: '',
  quantity: null,
  unitOfMeasure: '',
  weighted: false,
  priceAgorot,
});

const promo = (id: string, end: string, items: string[]): CanonPromo => ({
  chainId: 'A',
  promotionId: id,
  description: id,
  start: '2026-11-01T00:00',
  end,
  clubId: 0,
  clubName: '',
  isCoupon: false,
  minPurchaseAgorot: null,
  redemptionLimit: null,
  minItemsOffered: null,
  remarks: '',
  groups: [{ groupId: '1', rewardType: 3, minQty: 1, maxQty: null, discountRate: null, discountedPriceAgorot: 100, weighted: false, items }],
});

const store = (k: number, chainId: string, items: CanonItem[], promos: CanonPromo[] = []): StoreState => ({
  k, chainId, storeId: String(k), items, promos,
});

test('buildItemDocs merges one barcode across chains into a single price map', () => {
  const docs = buildItemDocs([
    store(1, 'A', [item('7613036984379', 2290, 'קפסולות'), item('A:101', 500)]),
    store(2, 'B', [item('7613036984379', 2190, 'קפסולות'), item('B:101', 700)]),
    store(3, 'B', [item('7613036984379', 2190, 'קפסולות סטארבקס')]),
  ]);
  assert.deepEqual(docs.get('7613036984379')!.p, { '1': 2290, '2': 2190, '3': 2190 });
  assert.equal(docs.get('7613036984379')!.n, 'קפסולות'); // most common name wins
  // Same internal code in two chains stays two items.
  assert.deepEqual(docs.get('A:101')!.p, { '1': 500 });
  assert.deepEqual(docs.get('B:101')!.p, { '2': 700 });
});

test('buildItemDocs: a real maker beats placeholders, and every chain\'s name and maker is searchable', () => {
  const made = (name: string, manufacturer: string): CanonItem => ({ ...item('7290010066575', 1000, name), manufacturer });
  const docs = buildItemDocs([
    store(1, 'A', [made('מארז רביעיית טונה במים 4*160 גרם', 'לא ידוע')]),
    store(2, 'B', [made('טונה במי מלח פילטונה4', 'תעשיות פילטונה')]),
    store(3, 'B', [made('טונה במי מלח פילטונה4', 'תעשיות פילטונה')]),
    store(4, 'C', [made('פילטונה במי מלח רביעייה', '---')]),
  ]);
  const d = docs.get('7290010066575')!;
  assert.equal(d.n, 'טונה במי מלח פילטונה4');
  assert.equal(d.m, 'תעשיות פילטונה');
  assert.equal(d.s, 'מארז רביעיית טונה במים 4*160 גרם | פילטונה במי מלח רביעייה');
  // Nothing to add → no field (keeps docs small and their hashes unchanged).
  assert.equal(docs.size, 1);
  const lone = buildItemDocs([store(1, 'A', [made('חלב 3%', 'לא ידוע')])]).get('7290010066575')!;
  assert.equal(lone.m, 'לא ידוע');
  assert.equal('s' in lone, false);
});

const sells = (...keys: string[]) => keys.map((k) => item(k, 1000));

test('buildPromoDocs dedupes identical promotions across stores and drops expired ones', () => {
  const docs = [...buildPromoDocs(
    [
      store(5, 'A', sells('x', 'y'), [promo('1', '2026-11-20T23:59', ['x', 'y']), promo('old', '2026-11-14T23:59', ['x'])]),
      store(2, 'A', sells('x', 'y'), [promo('1', '2026-11-20T23:59', ['x', 'y'])]),
    ],
    '2026-11-15T17:00',
  ).values()];
  assert.equal(docs.length, 1);
  assert.equal(docs[0].pid, '1');
  assert.deepEqual(docs[0].stores, [2, 5]);
  assert.deepEqual(docs[0].items, ['x', 'y']);
});

test('buildPromoDocs drops unsold items and unions item lists of stores with equal terms', () => {
  // Same PromotionID; store 1's copy lists x,y,z, store 2's lists x,y (store 2
  // doesn't sell z anyway); both list w, which neither sells — Shufersal
  // publishes chain-wide lists into every store's file.
  const docs = [...buildPromoDocs(
    [
      store(1, 'A', sells('x', 'y', 'z'), [promo('7', '2026-11-20T23:59', ['w', 'x', 'y', 'z'])]),
      store(2, 'A', sells('x', 'y'), [promo('7', '2026-11-20T23:59', ['w', 'x', 'y'])]),
      store(3, 'A', sells('q'), [promo('7', '2026-11-20T23:59', ['w', 'x'])]), // sells none → not listed
    ],
    '2026-11-15T17:00',
  ).values()];
  assert.equal(docs.length, 1);
  assert.match(docs[0]._id, /^A:7:/);
  assert.deepEqual(docs[0].stores, [1, 2]);
  assert.deepEqual(docs[0].items, ['x', 'y', 'z']);
});

test('buildPromoDocs drops per-store prices that are just the rate applied, so one deal stays one doc', () => {
  // "5% off": each store publishes regular × 0.95 for its own regular price.
  const pct = (dp: number): CanonPromo => {
    const p = promo('5', '2026-12-31T23:59', ['x']);
    return { ...p, groups: [{ ...p.groups[0], discountRate: 5, discountedPriceAgorot: dp }] };
  };
  const docs = [...buildPromoDocs(
    [store(1, 'A', [item('x', 1000)], [pct(950)]), store(2, 'A', [item('x', 1390)], [pct(1321)])],
    '2026-11-15T17:00',
  ).values()];
  assert.equal(docs.length, 1);
  assert.deepEqual(docs[0].stores, [1, 2]);
  assert.equal(docs[0].g[0].price, null);
  assert.equal(docs[0].g[0].rate, 5);
});

test('buildPromoDocs drops coupons that carry no numeric discount', () => {
  // Meal-voucher "gift" coupons list every item at its regular price.
  const p = promo('c', '2031-01-01T02:59', ['x']);
  const voucher: CanonPromo = { ...p, isCoupon: true, groups: [{ ...p.groups[0], rewardType: 0, discountedPriceAgorot: 1000 }] };
  const realCoupon: CanonPromo = { ...p, promotionId: 'd', isCoupon: true }; // 1.00 instead of 10.00
  const stats = { droppedCoupons: 0 };
  const docs = buildPromoDocs([store(1, 'A', [item('x', 1000)], [voucher, realCoupon])], '2026-11-15T17:00', stats);
  assert.deepEqual([...docs.values()].map((d) => d.pid), ['d']);
  assert.equal(stats.droppedCoupons, 1);
});

test('buildPromoDocs separates stores whose terms differ for the same PromotionID', () => {
  const p = promo('9', '2026-11-20T23:59', ['x']);
  const cheaper = { ...p, groups: [{ ...p.groups[0], discountedPriceAgorot: 90 }] };
  const docs = [...buildPromoDocs([store(1, 'A', sells('x'), [p]), store(2, 'A', sells('x'), [cheaper])], '2026-11-15T17:00').values()];
  assert.deepEqual(docs.map((d) => d.g[0].price).sort(), [100, 90].sort());
});

test('diffDocs writes only changed docs and deletes vanished ones', () => {
  const a = { _id: 'a', v: 1 };
  const b = { _id: 'b', v: 2 };
  const first = diffDocs(new Map([['a', a], ['b', b]]), {});
  assert.equal(first.upserts.length, 2);

  const same = diffDocs(new Map([['a', a], ['b', b]]), first.next);
  assert.equal(same.upserts.length, 0);
  assert.equal(same.deletes.length, 0);

  const changed = diffDocs(new Map([['a', { _id: 'a', v: 9 }]]), first.next);
  assert.deepEqual(changed.upserts.map((d) => d._id), ['a']);
  assert.deepEqual(changed.deletes, ['b']);
});

test('docHash ignores key order', () => {
  assert.equal(docHash({ a: 1, b: { c: 2, d: 3 } }), docHash({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notEqual(docHash({ a: 1 }), docHash({ a: 2 }));
});

test('israelLocalNow uses Asia/Jerusalem (UTC+2 in November)', () => {
  assert.equal(israelLocalNow(new Date('2026-11-15T21:59:00Z')), '2026-11-15T23:59');
  assert.equal(israelLocalNow(new Date('2026-11-15T22:00:00Z')), '2026-11-16T00:00');
});

test('buildPromoDocs matches promo items to the price file key when the files disagree on ItemType', () => {
  // Shufersal's PromoFull often leaves ItemType empty, so its key for a
  // barcode can be chain-scoped while the PriceFull key is the bare barcode
  // (and vice versa). The price file's key wins.
  const docs = [...buildPromoDocs(
    [store(1, 'A', [item('7613036984379', 2290), item('A:101', 500)], [promo('k', '2026-11-20T23:59', ['A:7613036984379', '101'])])],
    '2026-11-15T17:00',
  ).values()];
  assert.equal(docs.length, 1);
  assert.deepEqual(docs[0].items, ['7613036984379', 'A:101']);
});

test('buildStoreDocs carries the publish time of the price and promo files', () => {
  const docs = buildStoreDocs(
    [{
      chainId: '7290803800003', storeId: '40', subChainId: '000', name: 'באר שבע', address: '', city: '0', kind: 'physical',
      chainSlug: 'yohananof', chainName: 'יוחננוף', cityId: 'beer-sheva',
      priceFile: 'PriceFull7290803800003-000-040-20261115-004031.gz', promoFile: null,
    }],
    { '7290803800003:40': 3 },
  );
  const d = docs.get('7290803800003:40')!;
  assert.equal(d.k, 3);
  assert.equal(d.city, 'beer-sheva');
  assert.equal(d.pricesAt, '2026-11-15T00:40');
  assert.equal(d.promosAt, null);
});
