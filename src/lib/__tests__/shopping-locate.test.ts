import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curation, keepRule } from '../shopping/ingest/locate.ts';

const ctx = { pinnedCities: new Set(['tel-aviv']), curated: new Set(['yohananof/7']), skipped: new Set(['yohananof/9']) };

test('keepRule: a curated store is kept in a city with no pin', () => {
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/7', cityId: 'beer-sheva' }, ctx), 'keep');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'beer-sheva' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/9', cityId: 'tel-aviv' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'tel-aviv' }, ctx), 'locate');
  assert.equal(keepRule({ kind: 'online', key: 'x/1', cityId: null }, ctx), 'keep');
});

test('curation: every hand-match on an included row is curated, at the row point', () => {
  // Discovery merges two entries for one address (a store and its produce store)
  // into one row that names one official store; places/official.json names both.
  const rows = [
    { lat: 32.0037, lng: 34.804, refs: ['A:store', 'A:produce'], official: { chainSlug: 'hazi-hinam', storeId: '204' } },
    { lat: 31.24, lng: 34.81, refs: ['N1'], official: { chainSlug: 'yohananof', storeId: '54' } },
    { lat: 31.3, lng: 34.8, refs: ['N2'], official: null },
  ];
  const decisions = { 'A:store': 'include', 'A:produce': 'include', N1: 'skip', N2: 'include' };
  const hand = { 'A:store': 'hazi-hinam/204', 'A:produce': 'hazi-hinam/217', N2: 'yohananof/40' };
  const c = curation(rows, decisions, hand);
  assert.deepEqual([...c.curated].sort(), ['hazi-hinam/204', 'hazi-hinam/217', 'yohananof/40']);
  assert.deepEqual([...c.skipped], ['yohananof/54']);
  assert.deepEqual(c.matched.get('hazi-hinam/217'), { lat: 32.0037, lng: 34.804 });
  assert.deepEqual(c.matched.get('yohananof/40'), { lat: 31.3, lng: 34.8 });
});

test('curation: a store included on one row and skipped on another stays curated', () => {
  const rows = [
    { lat: 1, lng: 1, refs: ['a'], official: { chainSlug: 'x', storeId: '1' } },
    { lat: 2, lng: 2, refs: ['b'], official: { chainSlug: 'x', storeId: '1' } },
  ];
  const c = curation(rows, { a: 'skip', b: 'include' }, {});
  assert.deepEqual([...c.curated], ['x/1']);
  assert.equal(c.skipped.size, 0);
});
