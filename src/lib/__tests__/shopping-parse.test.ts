import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { blocks, decodeXmlBytes, field, isGzip, leafFields } from '../shopping/xml.ts';
import {
  isValidGtin,
  itemKey,
  normLocalDateTime,
  normStoreId,
  parseClub,
  parseFileName,
  parsePriceFile,
  parsePromoFile,
  parseStoresFile,
} from '../shopping/normalize.ts';
import { cityOf } from '../shopping/cities.ts';

const FIX = join(import.meta.dirname, 'fixtures', 'shopping');
const load = (chain: string, prefix: string) => {
  const name = readdirSync(join(FIX, chain)).find((f) => f.startsWith(prefix))!;
  const raw = new Uint8Array(readFileSync(join(FIX, chain, name)));
  return decodeXmlBytes(isGzip(raw) ? new Uint8Array(gunzipSync(raw)) : raw);
};

const YOH = '7290803800003';
const SHUF = '7290027600007';

// ── xml ──────────────────────────────────────────────────────────────────

test('decodeXmlBytes handles UTF-16 LE with BOM, UTF-8 BOM and windows-1255', () => {
  const s = '<Root><A>שלום</A></Root>';
  const u16 = new Uint8Array([0xff, 0xfe, ...new Uint8Array(new Uint16Array([...s].map((c) => c.charCodeAt(0))).buffer)]);
  assert.equal(decodeXmlBytes(u16), s);
  const u8 = new TextEncoder().encode(s);
  assert.equal(decodeXmlBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...u8])), s);
  // "שלום" in windows-1255 is F9 EC E5 ED — invalid as UTF-8.
  const cp = new Uint8Array([...new TextEncoder().encode('<A>'), 0xf9, 0xec, 0xe5, 0xed, ...new TextEncoder().encode('</A>')]);
  assert.equal(decodeXmlBytes(cp), '<A>שלום</A>');
});

test('blocks drops a record truncated by a broken file tail and is case-insensitive', () => {
  const xml = '<items><item><ItemCode>1</ItemCode></item><Item><ItemCode>2</ItemCode></Item><Item><ItemCode>3';
  assert.deepEqual(blocks(xml, 'Item').map((b) => field(b, 'itemcode')), ['1', '2']);
});

test('leafFields lower-cases tags, keeps self-closing as empty and decodes entities', () => {
  assert.deepEqual(leafFields('<PromotionId>5</PromotionId><Remarks /><Name>ת&quot;א &amp; ר&quot;ג</Name>'), {
    promotionid: '5',
    remarks: '',
    name: 'ת"א & ר"ג',
  });
});

// ── normalize helpers ────────────────────────────────────────────────────

test('item keys: valid GTINs cross-match, internal codes stay chain-scoped', () => {
  assert.equal(isValidGtin('7613036984379'), true);
  assert.equal(isValidGtin('7613036984378'), false); // wrong check digit
  assert.equal(isValidGtin('101114'), false); // short internal code
  assert.deepEqual(itemKey(YOH, '7613036984379', '1'), { key: '7613036984379', barcode: true });
  assert.deepEqual(itemKey(YOH, '101114', '0'), { key: `${YOH}:101114`, barcode: false });
  // ItemType 0 never cross-matches, even when the code looks like a barcode.
  assert.deepEqual(itemKey(YOH, '7613036984379', '0'), { key: `${YOH}:7613036984379`, barcode: false });
});

test('small normalizers', () => {
  assert.equal(normStoreId('001'), '1');
  assert.equal(normStoreId('000'), '0');
  assert.equal(normLocalDateTime('2026-11-20T23:59:00.000'), '2026-11-20T23:59');
  assert.equal(normLocalDateTime('2026-11-20'), '2026-11-20T00:00');
  assert.deepEqual(parseClub('0 - כלל הלקוחות'), { id: 0, name: 'כלל הלקוחות' });
  assert.deepEqual(parseClub('2 - מועדון אשראי של הקמעו'), { id: 2, name: 'מועדון אשראי של הקמעו' });
});

test('parseFileName covers the naming variants', () => {
  assert.deepEqual(parseFileName('PriceFull7290803800003-000-001-20261115-004031.gz'), {
    type: 'PriceFull', chainId: YOH, storeId: '1', stamp: '202611150040',
  });
  assert.deepEqual(parseFileName('Promo7290027600007-001-413-20261115-164044.gz'), {
    type: 'Promo', chainId: SHUF, storeId: '413', stamp: '202611151640',
  });
  assert.deepEqual(parseFileName('Stores7290803800003-000-20261115-010000.xml'), {
    type: 'Stores', chainId: YOH, storeId: null, stamp: '202611150100',
  });
  assert.deepEqual(parseFileName('Stores7290455000004-000-20261115060200-060200.xml'), {
    type: 'Stores', chainId: '7290455000004', storeId: null, stamp: '202611150602',
  });
  assert.deepEqual(parseFileName('StoresFull7290700100008-000-20261114-010352.gz.xml')?.type, 'Stores');
  assert.equal(parseFileName('readme.txt'), null);
});

// ── Yochananof regression (store 001, 2026-11-15) ────────────────────────

test('Yochananof PriceFull: Starbucks Colombia capsules = 22.90', () => {
  const f = parsePriceFile(load('yohananof', 'PriceFull'));
  assert.equal(f.chainId, YOH);
  assert.equal(f.storeId, '1');
  assert.equal(f.items.length + f.skipped, 10694);
  const it = f.items.find((i) => i.code === '7613036984379')!;
  assert.equal(it.priceAgorot, 2290);
  assert.equal(it.key, '7613036984379');
  assert.equal(it.barcode, true);
  assert.equal(it.quantity, 57);
  assert.equal(it.unitQty, 'גרם');
  assert.match(it.name, /סטארבקס/);
  // Internal codes are kept, but scoped to the chain.
  assert.ok(f.items.some((i) => !i.barcode && i.key.startsWith(`${YOH}:`)));
});

test('Yochananof PromoFull: promotion 373587', () => {
  const f = parsePromoFile(load('yohananof', 'PromoFull'));
  assert.equal(f.promos.length + f.skipped, 1270);
  const p = f.promos.find((x) => x.promotionId === '373587')!;
  assert.ok(p, 'promotion 373587 present');
  assert.equal(p.start, '2026-11-15T00:00');
  assert.equal(p.end, '2026-11-20T23:59');
  assert.equal(p.clubId, 0);
  assert.equal(p.clubName, 'כלל הלקוחות');
  assert.equal(p.redemptionLimit, 6);
  assert.equal(p.minItemsOffered, 10);
  assert.equal(p.isCoupon, false);
  const items = p.groups.flatMap((g) => g.items);
  assert.equal(items.length, 11);
  assert.ok(items.includes('7613036984379'));
  const g = p.groups.find((x) => x.items.includes('7613036984379'))!;
  assert.equal(g.discountedPriceAgorot, 1140);
  assert.equal(g.discountRate, 50);
  assert.equal(g.minQty, 1);
});

test('Yochananof Stores (UTF-16): 51 stores, city is always 0, so names decide', () => {
  const { chainId, stores } = parseStoresFile(load('yohananof', 'Stores'));
  assert.equal(chainId, YOH);
  assert.equal(stores.length, 51);
  assert.ok(stores.every((s) => s.city === '0'));
  const inCity = (id: string) => stores.filter((s) => cityOf(s) === id).map((s) => s.storeId).sort();
  assert.deepEqual(inCity('tel-aviv'), ['32', '35', '54']);
  assert.deepEqual(inCity('beer-sheva'), ['40']);
});

// ── Shufersal (store 001) ────────────────────────────────────────────────

test('Shufersal PriceFull + PromoFull parse with the same canonical schema', () => {
  const price = parsePriceFile(load('shufersal', 'PriceFull'));
  assert.equal(price.chainId, SHUF);
  assert.equal(price.storeId, '1');
  assert.equal(price.items.length + price.skipped, 6565);
  assert.ok(price.items.length > 6000);

  const promo = parsePromoFile(load('shufersal', 'PromoFull'));
  assert.equal(promo.promos.length + promo.skipped, 1257);
  // "2ב20 אורז פרסי" — 2 units for 20.00 total.
  const rice = promo.promos.find((p) => p.description.startsWith('2ב20 אורז פרסי'))!;
  assert.equal(rice.groups[0].minQty, 2);
  assert.equal(rice.groups[0].discountedPriceAgorot, 2000);
  // The one club-only promo in this file.
  assert.equal(promo.promos.filter((p) => p.clubId !== 0).length, 1);
});

test('Shufersal Stores: city codes are authoritative', () => {
  const { stores } = parseStoresFile(load('shufersal', 'Stores'));
  assert.equal(stores.length, 417);
  const byId = (id: string) => stores.find((s) => s.storeId === id)!;
  assert.equal(cityOf(byId('1')), 'tel-aviv');
  // Named "…באר שבע" but coded Lehavim (1271) / Omer (666).
  assert.equal(cityOf(byId('393')), null);
  assert.equal(cityOf(byId('40')), null);
});

// ── city rules ───────────────────────────────────────────────────────────

test('cityOf avoids the substring and street-name traps', () => {
  assert.equal(cityOf({ city: '0', name: 'איפוס ספירות מלאי' }), null);
  assert.equal(cityOf({ city: '0', name: 'אקספרס הציפורים' }), null);
  assert.equal(cityOf({ city: '0', name: 'קרית אליעזר' }), null); // address "תל אביב 11" is ignored
  assert.equal(cityOf({ city: '0', name: 'ת"א - אחד העם' }), 'tel-aviv');
  assert.equal(cityOf({ city: '', name: 'יפו מכללה יום ביום' }), 'tel-aviv');
  assert.equal(cityOf({ city: 'באר שבע', name: 'סניף 7' }), 'beer-sheva');
  assert.equal(cityOf({ city: '8600', name: 'x' }), 'ramat-gan');
  assert.equal(cityOf({ city: '6100', name: 'רמת גן איילון' }), null); // code wins
  assert.equal(cityOf({ city: '9000', name: 'Wolt Market Israel Test Venue' }), null);
});
