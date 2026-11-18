import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocodeQuery, nominatimUrl, parseGeocode } from '../shopping/geocode.ts';

test('geocodeQuery: trimmed, 2..120 characters, else null', () => {
  assert.equal(geocodeQuery('  הרצל 5 רמת גן '), 'הרצל 5 רמת גן');
  assert.equal(geocodeQuery('א'), null);
  assert.equal(geocodeQuery(''), null);
  assert.equal(geocodeQuery(undefined), null);
  assert.equal(geocodeQuery('x'.repeat(121)), null);
});

test('nominatimUrl: Israel only, Hebrew, at most 5, the address broken down', () => {
  const u = new URL(nominatimUrl('הרצל 5'));
  assert.equal(u.origin + u.pathname, 'https://nominatim.openstreetmap.org/search');
  assert.equal(u.searchParams.get('q'), 'הרצל 5');
  assert.equal(u.searchParams.get('countrycodes'), 'il');
  assert.equal(u.searchParams.get('accept-language'), 'he');
  assert.equal(u.searchParams.get('limit'), '5');
  assert.equal(u.searchParams.get('format'), 'jsonv2');
  assert.equal(u.searchParams.get('addressdetails'), '1');
});

test('parseGeocode: street + number + town as the label, points rounded; junk dropped', () => {
  const got = parseGeocode([
    { lat: '32.0684123', lon: '34.8248456', display_name: 'הרצל 5, רמת גן, מחוז תל אביב, ישראל', address: { road: 'הרצל', house_number: '5', city: 'רמת גן' } },
    { lat: '31.25', lon: '34.79', display_name: 'באר שבע, מחוז הדרום, ישראל', name: 'באר שבע', address: { city: 'באר שבע' } },
    { lat: 'x', lon: '34', display_name: 'bad' },
    { display_name: 'no point' },
  ]);
  assert.deepEqual(got, [
    { label: 'הרצל 5, רמת גן', lat: 32.0684, lng: 34.8248 },
    { label: 'באר שבע', lat: 31.25, lng: 34.79 },
  ]);
});

test('parseGeocode: no road → the first two parts of the display name; not an array → []', () => {
  assert.deepEqual(parseGeocode([{ lat: '32.1', lon: '34.8', display_name: 'עזריאלי, תל אביב-יפו, ישראל', address: { town: 'x' } }]),
    [{ label: 'עזריאלי, תל אביב-יפו', lat: 32.1, lng: 34.8 }]);
  assert.deepEqual(parseGeocode({ error: 'x' }), []);
});
