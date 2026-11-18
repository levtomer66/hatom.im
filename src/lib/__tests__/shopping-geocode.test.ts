import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocodeQuery, parseGeocode, photonUrl } from '../shopping/geocode.ts';

test('geocodeQuery: trimmed, 2..120 characters, else null', () => {
  assert.equal(geocodeQuery('  הרצל 5 רמת גן '), 'הרצל 5 רמת גן');
  assert.equal(geocodeQuery('א'), null);
  assert.equal(geocodeQuery(''), null);
  assert.equal(geocodeQuery(undefined), null);
  assert.equal(geocodeQuery('x'.repeat(121)), null);
});

test('photonUrl: Israel’s box, at most 6, the typed text only', () => {
  const u = new URL(photonUrl('אחד העם 5'));
  assert.equal(u.origin + u.pathname, 'https://photon.komoot.io/api/');
  assert.equal(u.searchParams.get('q'), 'אחד העם 5');
  assert.equal(u.searchParams.get('limit'), '6');
  assert.equal(u.searchParams.get('bbox'), '34.2,29.4,35.95,33.4');
  assert.equal(u.searchParams.get('lat'), null); // no location bias: the user's position never goes out
  assert.equal(u.searchParams.get('lon'), null);
});

const feature = (lng: number, lat: number, properties: Record<string, unknown>) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties });

test('parseGeocode: Photon features → "name, street number, town", rounded; outside Israel and junk dropped', () => {
  const got = parseGeocode({
    type: 'FeatureCollection',
    features: [
      feature(34.8120551, 31.8968174, { type: 'house', street: 'אחד העם', housenumber: '5', city: 'רחובות', countrycode: 'IL' }),
      feature(34.7888851, 32.071988, { type: 'house', name: 'עזריאלי שרונה', street: 'מנחם בגין', housenumber: '121', city: 'תל אביב–יפו', countrycode: 'IL' }),
      feature(34.8177099, 32.0505514, { type: 'street', name: 'עזריאל', city: 'רמת גן', countrycode: 'IL' }),
      feature(35.2, 31.9, { type: 'city', name: 'רמאללה', countrycode: 'PS' }),
      { type: 'Feature', geometry: { type: 'Point', coordinates: ['x', 32] }, properties: { name: 'bad', countrycode: 'IL' } },
      { type: 'Feature', properties: { name: 'no point', countrycode: 'IL' } },
    ],
  });
  assert.deepEqual(got, [
    { label: 'אחד העם 5, רחובות', lat: 31.8968, lng: 34.8121 },
    { label: 'עזריאלי שרונה, מנחם בגין 121, תל אביב–יפו', lat: 32.072, lng: 34.7889 },
    { label: 'עזריאל, רמת גן', lat: 32.0506, lng: 34.8177 },
  ]);
});

test('parseGeocode: a town is not repeated; the same label twice is kept once; not a collection → []', () => {
  assert.deepEqual(parseGeocode({ features: [
    feature(34.79, 31.25, { type: 'city', name: 'באר שבע', city: 'באר שבע', countrycode: 'IL' }),
    feature(34.79001, 31.25001, { type: 'city', name: 'באר שבע', countrycode: 'IL' }),
  ] }), [{ label: 'באר שבע', lat: 31.25, lng: 34.79 }]);
  assert.deepEqual(parseGeocode([{ lat: '1', lon: '2' }]), []);
  assert.deepEqual(parseGeocode(null), []);
});
