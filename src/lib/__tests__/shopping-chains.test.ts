import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAINS, chainBySlug } from '../shopping/chains.ts';

test('chain config: unique slugs and ids, 13-digit GS1 chain ids', () => {
  assert.equal(new Set(CHAINS.map((c) => c.slug)).size, CHAINS.length);
  assert.equal(new Set(CHAINS.map((c) => c.chainId)).size, CHAINS.length);
  for (const c of CHAINS) {
    assert.match(c.chainId, /^729\d{10}$/, c.slug);
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
