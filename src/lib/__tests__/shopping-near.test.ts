import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearStores, parseCentre, parseRadius, pickFavs, resolveWhere, type Centre } from '../shopping/near.ts';

test('parseCentre: both, neither, one, junk', () => {
  assert.deepEqual(parseCentre(32.0853123, '34.7818456'), { lat: 32.0853, lng: 34.7818 });
  assert.equal(parseCentre(undefined, undefined), null);
  assert.equal(parseCentre('', null), null);
  assert.equal(typeof parseCentre(32, undefined), 'string');
  assert.equal(typeof parseCentre('abc', 34), 'string');
  assert.equal(typeof parseCentre(91, 34), 'string');
  assert.equal(typeof parseCentre(32, 181), 'string');
});

test('parseRadius: one of 1/2/5/10, else 1', () => {
  assert.equal(parseRadius('5'), 5);
  assert.equal(parseRadius(10), 10);
  assert.equal(parseRadius('3'), 1);
  assert.equal(parseRadius(undefined), 1);
});

test('resolveWhere: live, else home, else none', () => {
  const a = { lat: 32, lng: 34.7 };
  const b = { lat: 31.25, lng: 34.79 };
  assert.deepEqual(resolveWhere(a, b, 2), { centre: a, source: 'live', radiusKm: 2 });
  assert.deepEqual(resolveWhere(null, b, 1), { centre: b, source: 'home', radiusKm: 1 });
  assert.deepEqual(resolveWhere(null, null, 5), { centre: null, source: 'none', radiusKm: 5 });
});

test('nearStores: radius, favorites, no point, online', () => {
  const c = { lat: 32.08, lng: 34.78 };
  const at = (dLatM: number) => ({ lat: c.lat + dLatM / 111_195, lng: c.lng });
  const s = (k: number, loc: Centre | null, kind: 'physical' | 'online' = 'physical') => ({ k, kind, loc });
  const stores = [s(1, at(900)), s(2, at(1100)), s(3, at(50_000)), s(4, null), s(5, null), s(6, null, 'online')];
  const where = { centre: c, source: 'live' as const, radiusKm: 1 };
  const got = nearStores(stores, where, [3, 5]);
  assert.deepEqual(got.map((x) => x.k), [1, 3, 5, 6]); // 2 outside, 4 unplaced and not ★
  assert.ok(Math.abs(got[0].distM! - 900) < 5);
  assert.ok(got[1].distM! > 49_000); // a ★ far away keeps its distance
  assert.equal(got[2].distM, null);
  assert.equal(got[3].distM, null);
  assert.deepEqual(nearStores(stores, { ...where, radiusKm: 2 }, []).map((x) => x.k), [1, 2, 6]);
});

test('nearStores: no centre → favorites and online only', () => {
  const stores = [{ k: 1, kind: 'physical' as const, loc: { lat: 32, lng: 34 } }, { k: 2, kind: 'online' as const, loc: null }];
  const none = { centre: null, source: 'none' as const, radiusKm: 1 };
  assert.deepEqual(nearStores(stores, none, []).map((x) => x.k), [2]);
  assert.deepEqual(nearStores(stores, none, [1]).map((x) => x.k), [1, 2]);
});

test('pickFavs: the page’s current favorites when sent (a star just tapped counts), else the saved ones', () => {
  assert.deepEqual(pickFavs([446, 433, 446], [1]), [446, 433]);
  assert.deepEqual(pickFavs([], [1, 2]), []); // every star removed
  assert.deepEqual(pickFavs(undefined, [1, 2]), [1, 2]);
  assert.deepEqual(pickFavs('x', [1, 2]), [1, 2]);
  assert.deepEqual(pickFavs([1, 'a', 2.5, 3], [9]), [9]); // junk → the saved ones
  assert.equal(pickFavs(Array.from({ length: 20 }, (_, i) => i), []).length, 10);
});
