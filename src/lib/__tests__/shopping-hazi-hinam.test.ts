import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { decodeXmlBytes } from '../shopping/xml.ts';
import { parseFileName, parseStoresFile } from '../shopping/normalize.ts';
import { CITIES, cityOf, ingestCityIds } from '../shopping/cities.ts';
import { chainBySlug } from '../shopping/chains.ts';
import { haziHinamListingUrl, parseHaziHinamListing } from '../shopping/ingest/sources.ts';

// Real files from shop.hazi-hinam.co.il/Prices, 2026-11-18 (the listing trimmed to 3 rows).
const FIX = join(import.meta.dirname, 'fixtures', 'shopping', 'hazi-hinam');
const listing = readFileSync(join(FIX, 'prices-t1-p1.html'), 'utf8');
const stores = parseStoresFile(
  decodeXmlBytes(new Uint8Array(gunzipSync(readFileSync(join(FIX, 'StoresFull7290700100008-000-20261118-001636.gz'))))),
).stores;

test('Hazi Hinam listing: blob links become remote files, by type and store', () => {
  const { files } = parseHaziHinamListing(listing);
  assert.deepEqual(
    files.map((f) => [f.name, f.info.type, f.info.storeId]),
    [
      ['Price7290700100008-000-204-20261118-153515.gz', 'Price', '204'],
      ['Price7290700100008-000-203-20261118-151727.gz', 'Price', '203'],
      ['PriceFull7290700100008-000-219-20261118-150610.gz', 'PriceFull', '219'],
    ],
  );
  assert.equal(files[2].ref, 'https://hazihinamprod01.blob.core.windows.net/regulatories/PriceFull7290700100008-000-219-20261118-150610.gz');
});

test('Hazi Hinam listing: the last page is the highest page link', () => {
  assert.equal(parseHaziHinamListing(listing).lastPage, 3);
  // A day with no files has no rows and no page links.
  assert.deepEqual(parseHaziHinamListing('<table><tbody></tbody></table>'), { files: [], lastPage: 1 });
});

test('Hazi Hinam listing URL: page, file-type code and day', () => {
  assert.equal(haziHinamListingUrl('PriceFull', '2026-11-18', 2), 'https://shop.hazi-hinam.co.il/Prices?p=2&t=1&d=2026-11-18');
  assert.equal(haziHinamListingUrl('PromoFull', '2026-11-17', 1), 'https://shop.hazi-hinam.co.il/Prices?p=1&t=2&d=2026-11-17');
  assert.equal(haziHinamListingUrl('Stores', '2026-11-18', 1), 'https://shop.hazi-hinam.co.il/Prices?p=1&t=3&d=2026-11-18');
});

test('Hazi Hinam StoresFull: a Stores file, 13 stores, names read despite "<StoreName >"', () => {
  assert.deepEqual(parseFileName('StoresFull7290700100008-000-20261118-001636.gz'), {
    type: 'Stores', chainId: '7290700100008', storeId: null, stamp: '202611180016',
  });
  assert.equal(stores.length, 13);
  const s204 = stores.find((s) => s.storeId === '204');
  assert.equal(s204?.name, 'כל בו חצי חינם מרכבה');
  assert.equal(s204?.kind, 'physical');
  assert.equal(stores.find((s) => s.storeId === '103')?.kind, 'online');
});

test('Holon (CBS 6600) is a city, kept out of the picker; only its stores land there', () => {
  const holon = CITIES.find((c) => c.id === 'holon');
  assert.equal(holon?.picker, false);
  const byId = (id: string) => cityOf(stores.find((s) => s.storeId === id)!);
  assert.equal(byId('204'), 'holon'); // כל בו חצי חינם מרכבה
  assert.equal(byId('217'), 'holon'); // its produce store, same address
  assert.equal(byId('201'), null); // Rishon LeZion is not a target city
});

test('--all-stores keeps whole picker cities, not a city added for far stores', () => {
  assert.ok(ingestCityIds({ allStores: false }).has('holon'));
  const all = ingestCityIds({ allStores: true });
  assert.ok(!all.has('holon'));
  assert.ok(all.has('tel-aviv') && all.has('ramat-gan') && all.has('beer-sheva'));
});

test('hazi-hinam chain uses its own listing client', () => {
  const c = chainBySlug('hazi-hinam');
  assert.equal(c?.chainId, '7290700100008');
  assert.deepEqual(c?.source, { kind: 'hazihinam' });
  assert.equal(c?.onlineStores, undefined); // 103 (delivery) not wanted
});
