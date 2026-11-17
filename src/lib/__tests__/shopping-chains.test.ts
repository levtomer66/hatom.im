import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAINS, chainBySlug } from '../shopping/chains.ts';

test('chain config: unique slugs and ids, 13-digit GS1 chain ids for price-file chains', () => {
  assert.equal(new Set(CHAINS.map((c) => c.slug)).size, CHAINS.length);
  assert.equal(new Set(CHAINS.map((c) => c.chainId)).size, CHAINS.length);
  for (const c of CHAINS) {
    if (c.source.kind !== 'wolt' && c.source.kind !== 'manual') assert.match(c.chainId, /^729\d{10}$/, c.slug);
    assert.match(c.slug, /^[a-z][a-z-]*$/, c.slug);
    assert.ok(c.name.trim(), c.slug);
    if (c.source.kind === 'cerberus') assert.ok(c.source.username, c.slug);
  }
});

test('chainBySlug finds the Cerberus chains added after the first two', () => {
  for (const slug of ['rami-levy', 'tiv-taam', 'dor-alon', 'fresh-market', 'keshet', 'osher-ad']) {
    assert.equal(chainBySlug(slug)?.source.kind, 'cerberus', slug);
  }
});

test('the Bina, Laibcatalog and PublishPrice chains carry what their fetcher needs', () => {
  const kinds = new Map(CHAINS.map((c) => [c.slug, c.source]));
  assert.deepEqual(kinds.get('bareket'), { kind: 'bina', host: 'superbareket' });
  assert.deepEqual(kinds.get('city-market'), { kind: 'bina', host: 'citymarketkiryatgat' });
  assert.deepEqual(kinds.get('victory'), { kind: 'laibcatalog' });
  assert.deepEqual(kinds.get('mahsani-hashuk'), { kind: 'laibcatalog' });
  assert.deepEqual(kinds.get('carrefour'), { kind: 'publishprice', site: 'carrefour' });
});
