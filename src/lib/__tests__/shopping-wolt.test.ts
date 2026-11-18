import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leafCategorySlugs, parseUnitInfo, woltBarcode, woltItems, type WoltItem } from '../shopping/wolt.ts';

const item = (over: Partial<WoltItem>): WoltItem => ({ id: 'i1', name: 'x', price: 1000, ...over });

test('GTIN-14 with a leading zero becomes the 13-digit barcode', () => {
  assert.equal(woltBarcode('07290000497044'), '7290000497044');
  assert.equal(woltBarcode('7290000497044'), '7290000497044');
  assert.equal(woltBarcode('07290000497045'), null); // bad check digit
  assert.equal(woltBarcode(null), null);
});

test('unit info', () => {
  assert.deepEqual(parseUnitInfo('750 g'), { quantity: 750, unitQty: 'גרם' });
  assert.deepEqual(parseUnitInfo('1.5 l'), { quantity: 1.5, unitQty: 'ליטר' });
  assert.deepEqual(parseUnitInfo(null), { quantity: null, unitQty: '' });
});

test('only leaf categories are fetched', () => {
  const slugs = leafCategorySlugs([
    { slug: 'produce', name: 'פירות וירקות', subcategories: [{ slug: 'veg', name: 'ירקות' }, { slug: 'fruit', name: 'פירות' }] },
    { slug: 'bread', name: 'לחם', subcategories: [] },
  ]);
  assert.deepEqual(slugs, ['veg', 'fruit', 'bread']);
});

test('items: barcodes cross-match, produce stays per venue and per kg, unavailable dropped', () => {
  const out = woltItems('mini-shani', [
    item({ id: 'a', name: 'לחם אקטיב ברמן 750 גרם', price: 2643, barcode_gtin: '07290000497044', unit_info: '750 g' }),
    item({ id: 'b', name: '‫מלפפון | ישראל', price: 1850, sell_by_weight_config: { price_per_kg: 1850 } }),
    item({ id: 'c', name: 'sold out', price: 500, barcode_gtin: '07290000497228', disabled_info: { reason: 'out' } }),
    item({ id: 'd', name: 'free?', price: 0 }),
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(
    { key: out[0].key, barcode: out[0].barcode, price: out[0].priceAgorot, q: out[0].quantity },
    { key: '7290000497044', barcode: true, price: 2643, q: 750 },
  );
  assert.equal(out[1].key, 'wolt:mini-shani/b');
  assert.equal(out[1].weighted, true);
  assert.equal(out[1].name, 'מלפפון | ישראל');
});

test('photo links: the first https image, kept on the item', () => {
  const [bread] = woltItems('v', [
    item({ id: 'a', barcode_gtin: '07290000497044', images: [{ url: 'https://imageproxy.wolt.com/assets/abc' }] }),
  ]);
  assert.equal(bread.img, 'https://imageproxy.wolt.com/assets/abc');
  const [none] = woltItems('v', [item({ id: 'b', images: [{ url: 'http://insecure/x' }] })]);
  assert.equal(none.img, undefined);
});
