import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimable, parseImportRequest, STALE_MS } from '../recipes/imports.ts';

test('a link alone', () => assert.deepEqual(parseImportRequest({ url: ' https://www.instagram.com/reel/abc/ ' }),
  { ok: true, value: { url: 'https://www.instagram.com/reel/abc/', text: '', note: '' } }));
test('text alone', () => assert.deepEqual(parseImportRequest({ text: 'Pancakes\n1 cup flour' }),
  { ok: true, value: { url: null, text: 'Pancakes\n1 cup flour', note: '' } }));
test('neither → error', () => assert.equal(parseImportRequest({ note: 'x' }).ok, false));
test('http or junk link refused', () => {
  assert.equal(parseImportRequest({ url: 'http://x.com/a' }).ok, false);
  assert.equal(parseImportRequest({ url: 'javascript:alert(1)' }).ok, false);
});
test('limits', () => {
  assert.equal(parseImportRequest({ text: 'x'.repeat(8001) }).ok, false);
  assert.equal(parseImportRequest({ url: 'https://a.com', note: 'x'.repeat(501) }).ok, false);
});
test('claimable: queued, or working and stale', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  assert.equal(claimable({ status: 'queued', claimedAt: null }, now), true);
  assert.equal(claimable({ status: 'working', claimedAt: new Date(now - 5 * 60_000).toISOString() }, now), false);
  assert.equal(claimable({ status: 'working', claimedAt: new Date(now - STALE_MS - 1).toISOString() }, now), true);
  assert.equal(claimable({ status: 'done', claimedAt: null }, now), false);
});
