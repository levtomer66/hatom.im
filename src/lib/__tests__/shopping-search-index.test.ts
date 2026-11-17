import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS_SEARCH_DEFINITION, ITEMS_SEARCH_INDEX, searchStage } from '../shopping/search-index.ts';

test('one must clause per word, each a should of three prefixes and a fuzzy text match', () => {
  const st = searchStage('  פילטונה   מים ') as { $search: { index: string; compound: { must: { compound: { should: unknown[] } }[] } } };
  assert.equal(st.$search.index, ITEMS_SEARCH_INDEX);
  assert.equal(st.$search.compound.must.length, 2);
  const should = st.$search.compound.must[1].compound.should as Record<string, { query: string; path: unknown; fuzzy: { maxEdits: number; prefixLength: number } }>[];
  assert.deepEqual(should.map((c) => Object.keys(c)[0]), ['autocomplete', 'autocomplete', 'autocomplete', 'text']);
  assert.equal(should[3].text.query, 'מים');
  assert.equal(should[3].text.fuzzy.prefixLength, 0); // "מים" matches "במים"
  assert.equal(should[3].text.fuzzy.maxEdits, 1); // short word: one edit
  assert.equal((searchStage('פילטונה') as never as { $search: { compound: { must: { compound: { should: { text?: { fuzzy: { maxEdits: number } } }[] } }[] } } })
    .$search.compound.must[0].compound.should[3].text!.fuzzy.maxEdits, 2);
});

test('empty query has no stage; at most five words', () => {
  assert.equal(searchStage('   '), null);
  const st = searchStage('א ב ג ד ה ו ז') as { $search: { compound: { must: unknown[] } } };
  assert.equal(st.$search.compound.must.length, 5);
});

test('the index maps n, m and s as words and prefixes, nothing else', () => {
  assert.equal(ITEMS_SEARCH_DEFINITION.mappings.dynamic, false);
  assert.deepEqual(Object.keys(ITEMS_SEARCH_DEFINITION.mappings.fields).sort(), ['m', 'n', 's']);
  for (const f of Object.values(ITEMS_SEARCH_DEFINITION.mappings.fields)) assert.deepEqual(f.map((x) => x.type), ['string', 'autocomplete']);
});
