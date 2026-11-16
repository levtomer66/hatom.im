import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchScore, rankHits } from '../shopping/search-rank.ts';
import { searchTerms } from '../shopping/lists.ts';

const names = (xs: { name: string }[]) => xs.map((x) => x.name);

test('eggs before egg noodles and egg salad, despite fewer stores', () => {
  const hits = [
    { name: 'אטריות ביצים רחבות 4', stores: 66 },
    { name: 'סלט ביצים 200 גרם', stores: 38 },
    { name: 'ביצים L ארוזות  12 י', stores: 28 },
    { name: '12ביצים חופש אורגניות M', stores: 29 },
  ];
  assert.deepEqual(names(rankHits(hits, searchTerms('ביצים'))), [
    '12ביצים חופש אורגניות M',
    'ביצים L ארוזות  12 י',
    'אטריות ביצים רחבות 4',
    'סלט ביצים 200 גרם',
  ]);
});

test('a whole word beats a longer word that starts with the term', () => {
  const t = searchTerms('חלב');
  assert.ok(matchScore('חלב תנובה 3%', t) > matchScore('חלבה בוטנים', t));
  assert.ok(matchScore('חלבה בוטנים', t) > matchScore('שוקו חלב', t));
  assert.ok(matchScore('שוקו חלב', t) > matchScore('משחלב', t));
});

test('items not sold in the city go last whatever the match', () => {
  const hits = [
    { name: 'ביצים L', stores: 0 },
    { name: 'סלט ביצים', stores: 3 },
  ];
  assert.deepEqual(names(rankHits(hits, searchTerms('ביצים'))), ['סלט ביצים', 'ביצים L']);
});

test('multi-word and quoted terms', () => {
  const t = searchTerms('קוטג׳ 5%');
  assert.ok(matchScore("קוטג' 5% תנובה", t) > matchScore('גבינת קוטג׳ 9%', t));
  assert.equal(matchScore('anything', ['(']), 0); // a bad pattern is skipped, not thrown
});
