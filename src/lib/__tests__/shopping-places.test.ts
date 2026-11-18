import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brandOf, circleBox, distanceM, inRing, matchOfficial, mergePlaces, cleanStoreStreet, pinContains, storeGeocodeQueries, streetOf, walkPrefilterM,
  type OfficialStore, type Place, type RawPlace,
} from '../shopping/places.ts';

const centre = { lat: 31.25, lng: 34.79 };

const raw = (over: Partial<RawPlace>): RawPlace => ({
  source: 'osm', name: 'x', lat: centre.lat, lng: centre.lng, address: '', category: '', ref: 'N1', ...over,
});

const place = (address: string, name = 'AM:PM'): Place => ({
  id: 'N1', name, names: [name], lat: 0, lng: 0, address, categories: [], sources: ['osm'], refs: ['N1'], distanceM: 0,
});

const store = (storeId: string, address: string, name = `Am-pm ${address}`): OfficialStore => ({
  chainSlug: 'dor-alon', storeId, name, address, cityId: 'tel-aviv',
});

test('distance and circle box agree', () => {
  const [w, s, e, n] = circleBox(centre, 1500);
  assert.ok(Math.abs(distanceM(centre, { lat: n, lng: centre.lng }) - 1500) < 1);
  assert.ok(Math.abs(distanceM(centre, { lat: centre.lat, lng: e }) - 1500) < 1);
  assert.ok(w < centre.lng && s < centre.lat);
});

test('point in ring', () => {
  const ring: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
  assert.equal(inRing({ lat: 1, lng: 1 }, ring), true);
  assert.equal(inRing({ lat: 3, lng: 1 }, ring), false);
});

test('streetOf strips the house number', () => {
  assert.equal(streetOf('חיים נחמן ביאליק 24'), 'חיים נחמן ביאליק');
  assert.equal(streetOf('שפירא 10-16'), 'שפירא');
  assert.equal(streetOf('8א'), '');
});

test('the same shop from Google and OSM merges; neighbours stay apart', () => {
  const merged = mergePlaces(
    [
      raw({ source: 'google', name: 'מינימרקט 7 בעיר - סניף מרכז הנגב', address: 'ראובן רובין 5', ref: 'G:a' }),
      raw({ source: 'osm', name: '7 בעיר', lat: centre.lat + 0.0003, address: 'ראובן רובין', ref: 'N2' }),
      raw({ source: 'google', name: 'סופר לב', lat: centre.lat + 0.0003, address: 'אליעזר בן יהודה 14', ref: 'G:b' }),
    ],
    centre,
  );
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0].sources, ['google', 'osm']);
});

test('house numbers decide between two branches on one street', () => {
  const stores = [store('511', 'הרצל 91,עובר להרצל 114)'), store('513', 'פרנקל 15')];
  assert.equal(matchOfficial(place('הרצל 114'), stores)?.storeId, '511');
  assert.equal(matchOfficial(place('הרצל 61'), stores), null);
  assert.equal(matchOfficial(place('הרב יצחק ידידיה פרנקל 15'), stores)?.storeId, '513');
});

test('without a house number only a sole candidate matches', () => {
  assert.equal(matchOfficial(place('פרנקל'), [store('513', 'פרנקל 15')])?.storeId, '513');
  assert.equal(matchOfficial(place('הרצל'), [store('1', 'הרצל 1'), store('2', 'הרצל 9')]), null);
});

test('brands', () => {
  assert.equal(brandOf(['AM:PM'])?.chainSlug, 'dor-alon');
  assert.equal(brandOf(['מחסני להב'])?.chainSlug, 'fresh-market');
  assert.equal(brandOf(['מגה'])?.retailer, 'קרפור / יינות ביתן');
  assert.equal(brandOf(['מכולת השכונה']), null);
});

test('geocode queries: cleaned street, street without number, then the store name', () => {
  assert.equal(cleanStoreStreet('רח. ביאליק 76'), 'ביאליק 76');
  assert.equal(cleanStoreStreet('אבן גבירול157'), 'אבן גבירול 157');
  assert.equal(cleanStoreStreet('יצחק נפחא 25 מתחם מבנה'), 'יצחק נפחא 25');
  assert.equal(cleanStoreStreet('רמת גן הירדן 29'), 'הירדן 29');
  assert.equal(cleanStoreStreet('הרצל 91,עובר להרצל 114)'), 'הרצל 91');
  assert.equal(cleanStoreStreet('unknown'), null);
  assert.deepEqual(storeGeocodeQueries({ name: 'Am-pm קינג גורג', address: 'קינג גורג 24', chainName: 'דור אלון' }, 'תל אביב'), [
    'קינג גורג 24 תל אביב', 'קינג גורג תל אביב',
  ]);
  assert.deepEqual(storeGeocodeQueries({ name: 'בן צבי תל אביב', address: 'unknown', chainName: 'יוחננוף' }, 'תל אביב'), ['בן צבי תל אביב']);
  assert.deepEqual(storeGeocodeQueries({ name: 'באר שבע', address: 'unknown', chainName: 'יוחננוף' }, 'באר שבע'), []);
});

test('pin test: circle radius, or the area outline', () => {
  const circle = { id: 'c', label: '', lat: centre.lat, lng: centre.lng, radiusM: 1500, city: 'beer-sheva' };
  assert.equal(pinContains(circle, null, { lat: centre.lat + 0.01, lng: centre.lng }), true); // ~1.1 km
  assert.equal(pinContains(circle, null, { lat: centre.lat + 0.02, lng: centre.lng }), false); // ~2.2 km
  const area = { id: 'a', label: '', lat: 1, lng: 1, osmArea: 'W1', city: 'tel-aviv' };
  const ring: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
  assert.equal(pinContains(area, ring, { lat: 1, lng: 1 }), true);
  assert.equal(pinContains(area, null, { lat: 1, lng: 1 }), false);
});

test('walk prefilter: no route of N minutes is longer than N×60×1.5 m in a straight line', () => {
  assert.equal(walkPrefilterM({ id: 'w', label: '', lat: 0, lng: 0, city: 'x', walkMinutes: 7 }), 630);
  assert.equal(walkPrefilterM({ id: 'r', label: '', lat: 0, lng: 0, city: 'x' }), 0);
});

test('a geresh is spelling, not a word break: ז\'בוטינסקי matches זבוטינסקי', () => {
  const stores = [store('517', 'זבוטינסקי 86', 'Am-pm זבוטינסקי ר"ג'), store('536', 'זבוטינסקי 44', 'Am-pmזבוטינסקי 44')];
  assert.equal(matchOfficial(place("רחוב זאב ז'בוטינסקי 86"), stores)?.storeId, '517');
  assert.equal(matchOfficial(place("רחוב זאב ז'בוטינסקי 44"), stores)?.storeId, '536');
});

test('corner addresses: the street before "פינת" is the one matched', () => {
  assert.equal(streetOf('הרצל פינת, דרך שלמה 91'), 'הרצל');
  assert.equal(streetOf("ביאליק פינת, רחוב זאב ז'בוטינסקי"), 'ביאליק');
  const stores = [store('511', 'הרצל 91,עובר להרצל 114)'), store('513', 'פרנקל 15')];
  assert.equal(matchOfficial(place('הרצל פינת, דרך שלמה 91'), stores)?.storeId, '511');
});
