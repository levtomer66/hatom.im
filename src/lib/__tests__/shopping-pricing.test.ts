import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dealMinQty, priceStore, rankStores, bestSplits, unitPriceAt,
  type PricedItem, type PricingOptions,
} from '../shopping/pricing.ts';
import type { PromoDoc, PromoGroupDoc } from '../shopping/snapshot.ts';

const NOW: PricingOptions = { now: '2026-11-15T12:00' };

const items = (...xs: [string, Record<string, number>, boolean?][]) =>
  new Map<string, PricedItem>(xs.map(([k, p, w]) => [k, { _id: k, p, w: w ?? false }]));

const part = (items: string[], o: Partial<PromoGroupDoc> = {}): PromoGroupDoc => ({
  gid: '1', rt: null, min: 1, max: null, rate: null, price: null, w: false, items, ...o,
});

let seq = 0;
const promo = (g: PromoGroupDoc[], o: Partial<PromoDoc> = {}): PromoDoc => ({
  _id: `c:${++seq}:x`, pid: String(seq), chain: 'c', d: `promo ${seq}`,
  s: '2026-11-01T00:00', e: '2026-11-20T23:59', club: 0, clubName: '', coupon: false,
  minAmt: null, limit: null, minItems: null, remarks: '', g,
  items: [...new Set(g.flatMap((x) => x.items))], stores: [1], ...o,
});

const line = (b: ReturnType<typeof priceStore>, key: string) => b.lines.find((l) => l.key === key)!;

test('no promo: regular price × qty', () => {
  const b = priceStore(1, [{ key: 'a', qty: 3 }], items(['a', { 1: 990 }]), [], NOW);
  assert.equal(b.total, 2970);
  assert.equal(line(b, 'a').effectiveUnit, 990);
});

test('regression: Yochananof 373587 — 50% on Starbucks capsules, up to 6 units, mix & match', () => {
  const caps = ['7613036984379', 'c2'];
  const it = items([caps[0], { 1: 2290 }], [caps[1], { 1: 2290 }]);
  const p = promo([part(caps, { rt: 3, min: 1, rate: 50, price: 1140 })], { limit: 6, minItems: 10 });
  const b = priceStore(1, [{ key: caps[0], qty: 5 }, { key: caps[1], qty: 3 }], it, [p], NOW);
  // 6 units at 11.40, the other 2 at 22.90.
  assert.equal(b.total, 6 * 1140 + 2 * 2290);
  assert.equal(b.regularTotal, 8 * 2290);
  assert.equal(line(b, caps[0]).applied[0].id, p._id);
});

test('X for Y: "2ב20" is a total for min units; leftovers at regular', () => {
  const it = items(['rice', { 1: 1190 }]);
  const p = promo([part(['rice'], { rt: 1, min: 2, rate: 16, price: 2000 })]);
  assert.equal(priceStore(1, [{ key: 'rice', qty: 1 }], it, [p], NOW).total, 1190);
  assert.equal(priceStore(1, [{ key: 'rice', qty: 2 }], it, [p], NOW).total, 2000);
  assert.equal(priceStore(1, [{ key: 'rice', qty: 5 }], it, [p], NOW).total, 2 * 2000 + 1190);
  assert.equal(unitPriceAt(1, 'rice', 2, it, [p], NOW), 1000);
  assert.equal(unitPriceAt(1, 'rice', 1, it, [p], NOW), 1190);
});

test('mix & match: units of different items pool into one bundle', () => {
  const it = items(['cakeA', { 1: 2490 }], ['cakeB', { 1: 2290 }]);
  const p = promo([part(['cakeA', 'cakeB'], { rt: 10, min: 2, price: 4000 })]);
  const b = priceStore(1, [{ key: 'cakeA', qty: 1 }, { key: 'cakeB', qty: 1 }], it, [p], NOW);
  assert.equal(b.total, 4000);
  // Savings split in proportion to the regular prices.
  assert.equal(line(b, 'cakeA').cost + line(b, 'cakeB').cost, 4000);
  assert.ok(line(b, 'cakeA').cost > line(b, 'cakeB').cost);
});

test('rate-only part (price null) takes the percent off regular', () => {
  const it = items(['x', { 1: 1000 }]);
  const p = promo([part(['x'], { rt: 2, rate: 5, price: null })]);
  assert.equal(priceStore(1, [{ key: 'x', qty: 2 }], it, [p], NOW).total, 1900);
});

test('a "deal" priced at or above regular is ignored', () => {
  const it = items(['x', { 1: 1090 }]);
  const p = promo([part(['x'], { rt: 12, price: 1090 })]);
  const b = priceStore(1, [{ key: 'x', qty: 1 }], it, [p], NOW);
  assert.equal(b.total, 1090);
  assert.deepEqual(line(b, 'x').applied, []);
});

test('redemption limit caps bundles, not units', () => {
  const it = items(['corn', { 1: 890 }]);
  const p = promo([part(['corn'], { min: 2, price: 1200 })], { limit: 1 });
  assert.equal(priceStore(1, [{ key: 'corn', qty: 4 }], it, [p], NOW).total, 1200 + 2 * 890);
});

test('1+1: the cheaper unit of each pair is free', () => {
  const it = items(['c4', { 1: 490 }], ['c8', { 1: 590 }]);
  const p = promo([
    part(['c4', 'c8'], { rt: 0, min: 1, price: 490 }),
    part(['c4', 'c8'], { gid: '2', rt: 10, min: 1, rate: 100, price: 0 }),
  ]);
  assert.equal(priceStore(1, [{ key: 'c4', qty: 1 }], it, [p], NOW).total, 490);
  assert.equal(priceStore(1, [{ key: 'c4', qty: 2 }], it, [p], NOW).total, 490);
  // 590 + 490 → the 490 is free.
  assert.equal(priceStore(1, [{ key: 'c4', qty: 1 }, { key: 'c8', qty: 1 }], it, [p], NOW).total, 590);
  // Three units: one pair plus one at regular.
  assert.equal(priceStore(1, [{ key: 'c8', qty: 3 }], it, [p], NOW).total, 2 * 590);
});

test('1+3: buy 3, the 4th (cheapest) free', () => {
  const it = items(['k', { 1: 1500 }], ['h', { 1: 1200 }]);
  const p = promo([part(['k', 'h'], { rt: 0, min: 3, price: 4490 }), part(['k', 'h'], { gid: '2', min: 1, rate: 100, price: 0 })]);
  const b = priceStore(1, [{ key: 'k', qty: 3 }, { key: 'h', qty: 1 }], it, [p], NOW);
  assert.equal(b.total, 3 * 1500);
  assert.equal(priceStore(1, [{ key: 'k', qty: 3 }], it, [p], NOW).total, 3 * 1500);
});

test('regression: Good Pharm 27675 — "השני ב-20": one unit at regular, the second at ₪20', () => {
  // Part 001 lists each item at its own regular price (informational); part 002 is the reward.
  const it = items(['solgar', { 1: 10490 }], ['vit', { 1: 4490 }]);
  const p = promo([
    part(['solgar'], { gid: '001', rt: 0, min: 1, price: 10490 }),
    part(['vit'], { gid: '001', rt: 0, min: 1, price: 4490 }),
    part(['solgar', 'vit'], { gid: '002', rt: 1, min: 1, price: 2000 }),
  ]);
  assert.equal(priceStore(1, [{ key: 'solgar', qty: 1 }], it, [p], NOW).total, 10490);
  assert.equal(priceStore(1, [{ key: 'solgar', qty: 2 }], it, [p], NOW).total, 10490 + 2000);
  // Mix & match: the cheaper unit is the one at ₪20.
  assert.equal(priceStore(1, [{ key: 'solgar', qty: 1 }, { key: 'vit', qty: 1 }], it, [p], NOW).total, 10490 + 2000);
  // Three units: one pair plus one at regular.
  assert.equal(priceStore(1, [{ key: 'solgar', qty: 3 }], it, [p], NOW).total, 2 * 10490 + 2000);
});

test('second unit at a percent off ("השני ב-50%")', () => {
  const it = items(['a', { 1: 1000 }]);
  const p = promo([part(['a'], { rt: 0, min: 1 }), part(['a'], { gid: '2', rt: 10, min: 1, rate: 50 })]);
  assert.equal(priceStore(1, [{ key: 'a', qty: 1 }], it, [p], NOW).total, 1000);
  assert.equal(priceStore(1, [{ key: 'a', qty: 2 }], it, [p], NOW).total, 1500);
  assert.equal(priceStore(1, [{ key: 'a', qty: 4 }], it, [p], NOW).total, 3000);
});

test('second unit for ₪1 (Super-Pharm): the buy part\'s price is informational', () => {
  const it = items(['cream', { 1: 2490 }]);
  const p = promo([part(['cream'], { rt: 0, min: 1, price: 1990 }), part(['cream'], { gid: '2', rt: 10, min: 1, price: 100 })]);
  assert.equal(priceStore(1, [{ key: 'cream', qty: 1 }], it, [p], NOW).total, 2490);
  assert.equal(priceStore(1, [{ key: 'cream', qty: 2 }], it, [p], NOW).total, 2490 + 100);
});

test('gift with purchase: buy from one set, a different item free', () => {
  const it = items(['cream', { 1: 69900 }], ['pump', { 1: 5000 }]);
  const p = promo([part(['cream'], { rt: 0, price: 69900 }), part(['pump'], { gid: '2', rt: 6, max: 1, rate: 100, price: 0 })]);
  assert.equal(priceStore(1, [{ key: 'cream', qty: 1 }, { key: 'pump', qty: 1 }], it, [p], NOW).total, 69900);
  assert.equal(priceStore(1, [{ key: 'pump', qty: 1 }], it, [p], NOW).total, 5000);
});

test('weighted: min 0.01 means price per kg; max caps the discounted weight', () => {
  const it = items(['salmon', { 1: 12000 }, true]);
  const p = promo([part(['salmon'], { rt: 3, min: 0.01, max: 3, rate: 17, price: 9990, w: true })]);
  assert.equal(priceStore(1, [{ key: 'salmon', qty: 0.5 }], it, [p], NOW).total, Math.round(0.5 * 9990));
  assert.equal(priceStore(1, [{ key: 'salmon', qty: 4 }], it, [p], NOW).total, 3 * 9990 + 12000);
});

test('weighted: "2 ק״ג ב-65" (min 1.9, price 6175) applies only above the minimum weight', () => {
  const it = items(['turkey', { 1: 3990 }, true]);
  const p = promo([part(['turkey'], { rt: 1, min: 1.9, rate: 19, price: 6175, w: true })]);
  assert.equal(priceStore(1, [{ key: 'turkey', qty: 1 }], it, [p], NOW).total, 3990);
  // 3250/kg once at least 1.9 kg.
  assert.equal(priceStore(1, [{ key: 'turkey', qty: 2 }], it, [p], NOW).total, 6500);
});

test('dates: not-yet-started and ended promos do not apply', () => {
  const it = items(['x', { 1: 1000 }]);
  const future = promo([part(['x'], { price: 500 })], { s: '2026-11-16T00:00' });
  const past = promo([part(['x'], { price: 500 })], { e: '2026-11-15T11:59' });
  assert.equal(priceStore(1, [{ key: 'x', qty: 1 }], it, [future, past], NOW).total, 1000);
});

test('club promo is shown as an offer, applied only for members', () => {
  const it = items(['x', { 1: 1000 }]);
  const p = promo([part(['x'], { price: 700 })], { club: 3, clubName: 'מועדון' });
  const b = priceStore(1, [{ key: 'x', qty: 1 }], it, [p], NOW);
  assert.equal(b.total, 1000);
  assert.deepEqual(line(b, 'x').offers.map((o) => [o.reason, o.clubName]), [['club', 'מועדון']]);
  assert.equal(priceStore(1, [{ key: 'x', qty: 1 }], it, [p], { ...NOW, clubs: [3] }).total, 700);
});

test('coupons apply only when asked', () => {
  const it = items(['honey', { 1: 1690 }]);
  const p = promo([part(['honey'], { rt: 2, rate: 100, price: 0 })], { coupon: true, limit: 1 });
  assert.equal(priceStore(1, [{ key: 'honey', qty: 1 }], it, [p], NOW).total, 1690);
  assert.equal(priceStore(1, [{ key: 'honey', qty: 2 }], it, [p], { ...NOW, coupons: true }).total, 1690);
});

test('basket minimum: applies once the store subtotal reaches it', () => {
  const it = items(['meat', { 1: 6000 }, true], ['bread', { 1: 1000 }]);
  const p = promo([part(['meat'], { rt: 3, min: 0.01, price: 5000, w: true })], { minAmt: 9900 });
  const small = priceStore(1, [{ key: 'meat', qty: 1 }], it, [p], NOW);
  assert.equal(small.total, 6000);
  assert.equal(line(small, 'meat').offers[0].reason, 'min-purchase');
  assert.equal(priceStore(1, [{ key: 'meat', qty: 1 }, { key: 'bread', qty: 4 }], it, [p], NOW).total, 5000 + 4000);
});

test('promos of other stores are ignored', () => {
  const it = items(['x', { 1: 1000, 2: 1000 }]);
  const p = promo([part(['x'], { price: 500 })], { stores: [2] });
  assert.equal(priceStore(1, [{ key: 'x', qty: 1 }], it, [p], NOW).total, 1000);
  assert.equal(priceStore(2, [{ key: 'x', qty: 1 }], it, [p], NOW).total, 500);
});

test('competing promos: a unit counts toward only the better one', () => {
  const it = items(['x', { 1: 1000 }]);
  const pct = promo([part(['x'], { rate: 10 })]);
  const bundle = promo([part(['x'], { min: 2, price: 1500 })]);
  const b = priceStore(1, [{ key: 'x', qty: 3 }], it, [pct, bundle], NOW);
  // 2 for 15 on two units, 10% off the third.
  assert.equal(b.total, 1500 + 900);
  assert.equal(line(b, 'x').applied.length, 2);
});

test('missing items are listed and ranked after complete stores', () => {
  const it = items(['a', { 1: 1000, 2: 500 }], ['b', { 1: 1000 }]);
  const ranked = rankStores([1, 2], [{ key: 'a', qty: 1 }, { key: 'b', qty: 1 }], it, [], NOW);
  assert.deepEqual(ranked.map((r) => r.store), [1, 2]);
  assert.deepEqual(ranked[1].missing, ['b']);
});

test('best split: each line goes to its cheaper store', () => {
  const it = items(['a', { 1: 1000, 2: 600, 3: 900 }], ['b', { 1: 500, 2: 900, 3: 800 }]);
  const lines = [{ key: 'a', qty: 1 }, { key: 'b', qty: 1 }];
  const ranked = rankStores([1, 2, 3], lines, it, [], NOW);
  const [best] = bestSplits(ranked, lines, it, [], NOW);
  assert.equal(best.total, 1100);
  assert.deepEqual(best.stores.map((s) => [s.store, s.lines.map((l) => l.key)]), [[1, ['b']], [2, ['a']]]);
});

test('best split re-prices each half, so a broken mix & match deal is not counted', () => {
  // Store 1: a + b for 10 together (5 each). Store 2: a for 4.50, b dearer.
  const it = items(['a', { 1: 800, 2: 450 }], ['b', { 1: 800, 2: 900 }]);
  const p = promo([part(['a', 'b'], { min: 2, price: 1000 })]);
  const lines = [{ key: 'a', qty: 1 }, { key: 'b', qty: 1 }];
  const ranked = rankStores([1, 2], lines, it, [p], NOW);
  assert.deepEqual(ranked.map((r) => [r.store, r.total]), [[1, 1000], [2, 1350]]);
  const [split] = bestSplits(ranked, lines, it, [p], NOW);
  // a → store 2 (450 < 500), b → store 1, where alone it is back to 800.
  assert.equal(split.total, 450 + 800);
});

// ---- one unit across the city (search results) ----

import { unitAcross } from '../shopping/pricing.ts';

test('the cheapest store for one unit counts a sale, like the product view', () => {
  const it = items(['snack', { 1: 1590, 2: 1890, 3: 1690 }]);
  const sale = promo([part(['snack'], { rt: 1, min: 1, price: 1390 })], { stores: [2] });
  const u = unitAcross([1, 2, 3, 4], 'snack', it, [sale], NOW)!;
  assert.equal(u.store, 2);
  assert.equal(u.min, 1390);
  assert.equal(u.max, 1690); // the dearest price paid, Bareket's 18.90 is now 13.90
  assert.equal(u.stores, 3);
  assert.equal(u.onSale, true);
});

test('a multi-buy deal does not lower the one-unit price; no store sells it → null', () => {
  const it = items(['rice', { 1: 1190, 2: 1290 }]);
  const two = promo([part(['rice'], { rt: 1, min: 2, price: 1000 })], { stores: [2] });
  const u = unitAcross([1, 2], 'rice', it, [two], NOW)!;
  assert.deepEqual([u.store, u.min, u.max, u.onSale], [1, 1190, 1290, false]);
  assert.equal(unitAcross([9], 'rice', it, [], NOW), null);
});

test('dealMinQty: buy and reward units together, else the first part\'s minimum', () => {
  const second = promo([part(['a'], { rt: 0, min: 1 }), part(['a'], { gid: '2', min: 1, price: 2000 })]);
  const oneOne = promo([part(['a'], { rt: 0, min: 1 }), part(['a'], { gid: '2', min: 1, rate: 100, price: 0 })]);
  const twoFor = promo([part(['a'], { min: 2, price: 2000 })]);
  assert.equal(dealMinQty(second), 2);
  assert.equal(dealMinQty(oneOne), 2);
  assert.equal(dealMinQty(twoFor), 2);
  assert.equal(dealMinQty(promo([part(['a'], { rate: 10 })])), 1);
});

test('regression: Good Pharm 27883 "מישל מרסייה 2 ב-10" on ₪69.90 items is not applied, listed as unclear', () => {
  const it = items(['serum', { 1: 6990 }]);
  const p = promo([part(['serum'], { gid: '001', rt: 10, min: 2, price: 1000 })]);
  const l = line(priceStore(1, [{ key: 'serum', qty: 2 }], it, [p], NOW), 'serum');
  assert.equal(l.cost, 2 * 6990);
  assert.deepEqual(l.applied, []);
  assert.deepEqual(l.offers.map((o) => o.reason), ['unclear']);
});

test('a deep but plausible deal (16% of shelf) still applies; a negative price never does', () => {
  const it = items(['a', { 1: 1290 }]);
  const deep = promo([part(['a'], { min: 2, price: 420 })]); // 2.10 a unit on 12.90 = 16%
  assert.equal(priceStore(1, [{ key: 'a', qty: 2 }], it, [deep], NOW).total, 420);
  const negative = promo([part(['a'], { min: 1, price: -14999 })]);
  assert.equal(priceStore(1, [{ key: 'a', qty: 1 }], it, [negative], NOW).total, 1290);
});
