import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepRule } from '../shopping/ingest/locate.ts';

const ctx = { pinnedCities: new Set(['tel-aviv']), curated: new Set(['yohananof/7']), skipped: new Set(['yohananof/9']) };

test('keepRule: a curated store is kept in a city with no pin', () => {
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/7', cityId: 'beer-sheva' }, ctx), 'keep');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'beer-sheva' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/9', cityId: 'tel-aviv' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'tel-aviv' }, ctx), 'locate');
  assert.equal(keepRule({ kind: 'online', key: 'x/1', cityId: null }, ctx), 'keep');
});
