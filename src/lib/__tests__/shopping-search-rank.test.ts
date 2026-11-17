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

// ---- spelling-tolerant patterns ----

import { searchPatterns } from '../shopping/search-rank.ts';

const matches = (q: string, name: string, typos = false) =>
  searchPatterns(q, { typos }).every((p) => new RegExp(p, 'iu').test(name));

test('vowel letters are optional both ways', () => {
  assert.ok(matches('פילטונה', 'טונה במי מלח פלטונה'));
  assert.ok(matches('פלטונה', 'נתחי טונה פילטונה'));
  assert.ok(matches('שקולד', 'שוקולד מריר'));
});

test('final letters, ה/א endings and quote marks', () => {
  assert.ok(matches('גבינה', 'גבינא לבנה'));
  assert.ok(matches('עוף', 'שניצל עופ'));
  assert.ok(matches('קוטג', "קוטג' 5%"));
  assert.ok(matches('קוטג׳', 'קוטג 5% תנובה'));
});

test('every word must match; short words keep their vowels', () => {
  assert.ok(matches('פילטונה מים', 'מארז רביעיית טונה במים פילטונה'));
  assert.ok(!matches('מים', 'ממרח שוקולד'));
  assert.ok(!matches('פילטונה מים', 'טונה במי מלח פילטונה'));
});

test('typo mode accepts one missing or wrong letter, not the first', () => {
  assert.ok(!matches('פילטומה', 'טונה פילטונה'));
  assert.ok(matches('פילטומה', 'טונה פילטונה', true));
  assert.ok(matches('פילטנה', 'טונה פילטונה')); // a dropped vowel letter isn't even a typo
  assert.ok(matches('שוקולט', 'שוקולד מריר', true));
  assert.ok(!matches('מוקולד', 'שוקולד מריר', true));
  assert.ok(matches('פילטונה מים', 'טונה במי מלח פילטונה', true)); // "מים" ≈ "מי" on the retry
});

test('rankHits counts a manufacturer-only match below a name match', () => {
  const t = searchPatterns('פילטונה');
  const hits = [
    { name: 'טונה במים', manufacturer: 'תעשיות פילטונה', stores: 5 },
    { name: 'טונה פילטונה', manufacturer: 'לא ידוע', stores: 2 },
  ];
  assert.deepEqual(rankHits(hits, t).map((h) => h.name), ['טונה פילטונה', 'טונה במים']);
});

test('on the typo retry, words matched as typed outrank typo matches', () => {
  const q = 'פילטונה מים';
  const hits = [
    { name: 'מיץ תפוזים פונטנה 1 ליטר', manufacturer: 'לא ידוע', stores: 9 },
    { name: 'טונה במי מלח 4*140 גרם', manufacturer: 'פילטונה תעשייה ומסחר', stores: 3 },
  ];
  const ranked = rankHits(hits, searchPatterns(q), searchPatterns(q, { typos: true }));
  assert.deepEqual(ranked.map((h) => h.name), ['טונה במי מלח 4*140 גרם']); // the typo-only juice is dropped
});

test('on the typo retry, more words matched as typed wins over a better single match', () => {
  const q = 'פילטונה מים';
  const hits = [
    { name: 'מגבונים להסרת איפור מים מיסלריים', manufacturer: 'ספטונה', stores: 6 },
    { name: 'מארז רביעיית טונה במים 4*160 גרם', manufacturer: 'תעשיות פילטונה', stores: 2 },
  ];
  const ranked = rankHits(hits, searchPatterns(q), searchPatterns(q, { typos: true }));
  assert.equal(ranked[0].name, 'מארז רביעיית טונה במים 4*160 גרם');
});

test('on the typo retry, a word found only in another chain\'s name (aka) still counts', () => {
  const q = 'פילטונה מים';
  const hits = [
    { name: 'מיץ תפוזים פונטנה', manufacturer: 'לא ידוע', stores: 9 },
    { name: 'מארז רביעיית טונה', manufacturer: 'לא ידוע', aka: 'טונה במים פילטונה4', stores: 2 },
  ];
  const ranked = rankHits(hits, searchPatterns(q), searchPatterns(q, { typos: true }));
  assert.deepEqual(ranked.map((h) => h.name), ['מארז רביעיית טונה']);
});
