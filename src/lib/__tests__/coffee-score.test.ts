import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COFFEE_AREAS,
  COFFEE_CATEGORIES,
  COFFEE_TAGS,
  computeStats,
  DEFAULT_CONTROLS,
  type CoffeeControls,
  filterReviews,
  fuzzyMatch,
  isOpenNow,
  isValidArea,
  parseControls,
  priceLevelLabel,
  priceLevelRank,
  PRICE_LEVELS,
  priceTier,
  resolveDisabledCategories,
  resolveOpeningHours,
  resolvePriceLevel,
  resolveTags,
  resolveTriedItems,
  reviewerGap,
  scoreReview,
  serializeControls,
  sortReviews,
  type CoffeeCategory,
  type CoffeeReview,
  type ScorableReview,
} from '../../types/coffee.ts';

// Four scored categories now (price became a descriptive place-level field).
// tom:   coffee 8, food 4, atmosphere 9 → mean 7.0   (pastry unrated)
// tomer: coffee 9, food 2, atmosphere 8.5 → mean 6.5  (pastry unrated)
const RATED: ScorableReview = {
  tomCoffeeRating: 8,
  tomFoodRating: 4,
  tomAtmosphereRating: 9,
  tomerCoffeeRating: 9,
  tomerFoodRating: 2,
  tomerAtmosphereRating: 8.5,
};

const byId = (s: ReturnType<typeof scoreReview>, id: CoffeeCategory) =>
  s.categories.find((c) => c.id === id)!;

test('the registry is the four scored categories in display order', () => {
  assert.deepEqual(
    COFFEE_CATEGORIES.map((c) => c.id),
    ['coffee', 'food', 'pastry', 'atmosphere'],
  );
});

test('a fully-rated review (no pastry) averages its rated categories', () => {
  const s = scoreReview(RATED);
  assert.equal(s.tom, 7);
  assert.equal(s.tomer, 6.5);
  assert.equal(s.combined, 6.75);
  assert.equal(byId(s, 'coffee').combined, 8.5);
  assert.equal(byId(s, 'food').combined, 3);
  assert.equal(s.categories.length, 4);
  assert.ok(s.categories.every((c) => !c.disabled));
});

test('a legacy document with no disabledCategories field is identical to an empty array', () => {
  assert.deepEqual(scoreReview(RATED), scoreReview({ ...RATED, disabledCategories: [] }));
});

test('disabling food drops it from both reviewers and from the combined score', () => {
  const s = scoreReview({ ...RATED, disabledCategories: ['food'] });
  // tom: mean(coffee 8, atmosphere 9) = 8.5 · tomer: mean(9, 8.5) = 8.75
  assert.equal(s.tom, 8.5);
  assert.equal(s.tomer, 8.75);
  assert.equal(s.combined, 8.625);

  const food = byId(s, 'food');
  assert.equal(food.disabled, true);
  assert.equal(food.tom, 0);
  assert.equal(food.tomer, 0);
  assert.equal(food.combined, 0);

  // The grid stays four wide so the card can render the ring in place.
  assert.equal(s.categories.length, 4);
  assert.equal(byId(s, 'coffee').disabled, false);
});

test('disabling ignores stored ratings rather than depending on them being zeroed', () => {
  const stillStored = scoreReview({ ...RATED, disabledCategories: ['food'] });
  const zeroed = scoreReview({
    ...RATED,
    tomFoodRating: 0,
    tomerFoodRating: 0,
    disabledCategories: ['food'],
  });
  assert.deepEqual(stillStored, zeroed);
});

test('a zero inside an active category still means "not rated yet"', () => {
  const s = scoreReview({ ...RATED, tomFoodRating: 0 });
  assert.equal(s.tom, 8.5);    // mean(8, 9) — the 0 is skipped
  assert.equal(s.tomer, 6.5);  // unchanged
  assert.equal(s.combined, 7.5);

  const food = byId(s, 'food');
  assert.equal(food.disabled, false);  // NOT the same state as disabled
  assert.equal(food.combined, 2);      // only Tomer's 2 counts
});

test('all four disabled scores as unrated', () => {
  const s = scoreReview({
    ...RATED,
    disabledCategories: ['coffee', 'food', 'pastry', 'atmosphere'],
  });
  assert.equal(s.tom, 0);
  assert.equal(s.tomer, 0);
  assert.equal(s.combined, 0);
  assert.equal(s.categories.length, 4);
  assert.ok(s.categories.every((c) => c.disabled));
});

test('an empty review scores zero rather than NaN', () => {
  const s = scoreReview({});
  assert.equal(s.tom, 0);
  assert.equal(s.tomer, 0);
  assert.equal(s.combined, 0);
});

test('resolveDisabledCategories defaults, de-dupes, and rejects', () => {
  assert.deepEqual(resolveDisabledCategories(undefined), []);
  assert.deepEqual(resolveDisabledCategories(null), []);
  assert.deepEqual(resolveDisabledCategories([]), []);
  assert.deepEqual(resolveDisabledCategories(['food']), ['food']);
  assert.deepEqual(resolveDisabledCategories(['food', 'food']), ['food']);
  assert.deepEqual(resolveDisabledCategories(['atmosphere', 'coffee']), ['atmosphere', 'coffee']);

  // 'price' is no longer a category — a stale client sending it is rejected.
  assert.equal(resolveDisabledCategories(['price']), null);
  assert.equal(resolveDisabledCategories(['nope']), null);
  assert.equal(resolveDisabledCategories('food'), null);
  assert.equal(resolveDisabledCategories(42), null);
  assert.equal(resolveDisabledCategories([1]), null);
  assert.equal(resolveDisabledCategories({ food: true }), null);
});

test('a review with no pastry rating scores exactly as before (pastry unrated)', () => {
  // RATED has no pastry fields → pastry is 0 = unrated = excluded.
  const s = scoreReview(RATED);
  assert.equal(byId(s, 'pastry').tom, 0);
  assert.equal(byId(s, 'pastry').combined, 0);
  // Tom's overall is still the mean of his 3 rated categories (8,4,9) = 7.0
  assert.equal(s.tom, 7);
});

test('a rated pastry participates in the average', () => {
  const s = scoreReview({ ...RATED, tomPastryRating: 10, tomerPastryRating: 10 });
  // Tom now averages 8,4,10,9 = 7.75
  assert.equal(Number(s.tom.toFixed(2)), 7.75);
  assert.equal(byId(s, 'pastry').combined, 10);
});

test('disabling pastry excludes it even when rated', () => {
  const s = scoreReview({
    ...RATED, tomPastryRating: 1, tomerPastryRating: 1,
    disabledCategories: ['pastry'],
  });
  assert.equal(byId(s, 'pastry').disabled, true);
  assert.equal(s.tom, 7); // back to the 3-category average
});

// ─── Price level (descriptive, place-level) ─────────────────────────────────

test('PRICE_LEVELS is the five labels, most-expensive → cheapest', () => {
  assert.deepEqual(
    PRICE_LEVELS.map((l) => l.id),
    ['very-expensive', 'expensive', 'standard', 'cheap', 'very-cheap'],
  );
  for (const l of PRICE_LEVELS) assert.ok(l.id && l.label);
  assert.equal(priceLevelLabel('cheap'), 'זול');
  assert.equal(priceLevelLabel(undefined), null);
});

test('resolvePriceLevel: absent → undefined, valid → itself, junk → null', () => {
  assert.equal(resolvePriceLevel(undefined), undefined);
  assert.equal(resolvePriceLevel(null), undefined);
  assert.equal(resolvePriceLevel(''), undefined);
  assert.equal(resolvePriceLevel('cheap'), 'cheap');
  assert.equal(resolvePriceLevel('very-expensive'), 'very-expensive');
  assert.equal(resolvePriceLevel('nope'), null);
  assert.equal(resolvePriceLevel(3), null);
  assert.equal(resolvePriceLevel(['cheap']), null);
});

test('priceLevelRank: cheaper is smaller, unset is null', () => {
  assert.equal(priceLevelRank(undefined), null);
  assert.equal(priceLevelRank('very-cheap'), 1);
  assert.equal(priceLevelRank('very-expensive'), 5);
  assert.ok((priceLevelRank('cheap') ?? 99) < (priceLevelRank('expensive') ?? 0));
});

test('resolveTags defaults, de-dupes, and rejects', () => {
  assert.deepEqual(resolveTags(undefined), []);
  assert.deepEqual(resolveTags(null), []);
  assert.deepEqual(resolveTags(['work', 'work', 'vegan']), ['work', 'vegan']);
  assert.equal(resolveTags(['nope']), null);
  assert.equal(resolveTags('work'), null);
  assert.equal(resolveTags([1]), null);
});

test('every tag has an id, label and emoji', () => {
  for (const t of COFFEE_TAGS) {
    assert.ok(t.id && t.label && t.emoji);
  }
  assert.ok(COFFEE_TAGS.some((t) => t.id === 'bitter'));
});

test('isValidArea accepts known areas only', () => {
  assert.equal(isValidArea('פלורנטין'), true);
  assert.equal(isValidArea('אחר'), true);
  assert.equal(isValidArea('Paris'), false);
  assert.equal(isValidArea(3), false);
  assert.equal(COFFEE_AREAS.length, 11);
});

test('priceTier buckets coffee prices', () => {
  assert.equal(priceTier(undefined), 0);
  assert.equal(priceTier(0), 0);
  assert.equal(priceTier(13), 1);
  assert.equal(priceTier(15), 1);
  assert.equal(priceTier(18), 2);
  assert.equal(priceTier(20), 2);
  assert.equal(priceTier(24), 3);
});

test('reviewerGap is the absolute overall difference, 0 when one side is unrated', () => {
  // RATED: tom overall 7.0, tomer overall 6.5 → gap 0.5
  assert.equal(Number(reviewerGap(RATED).toFixed(2)), 0.5);
  // only Tom rated → gap 0 (not controversial)
  assert.equal(reviewerGap({ tomCoffeeRating: 9 }), 0);
  // empty → 0
  assert.equal(reviewerGap({}), 0);
});

// A weekly schedule: closed Sunday(0), open 08:00-17:00 the rest.
const HOURS = [
  null,
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '09:00', close: '14:00' },
];

test('isOpenNow respects the Jerusalem weekday + time', () => {
  // 2026-09-14 is a Monday. 12:00 Jerusalem (09:00Z in Sep, IDT = UTC+3).
  assert.equal(isOpenNow(HOURS, new Date('2026-09-14T09:00:00Z')), true);
  // Monday 18:00 Jerusalem (15:00Z) → closed
  assert.equal(isOpenNow(HOURS, new Date('2026-09-14T15:00:00Z')), false);
  // 2026-09-13 is a Sunday → closed all day
  assert.equal(isOpenNow(HOURS, new Date('2026-09-13T09:00:00Z')), false);
  // no data → false
  assert.equal(isOpenNow(undefined, new Date('2026-09-14T09:00:00Z')), false);
});

test('resolveTriedItems normalizes and rejects', () => {
  assert.deepEqual(resolveTriedItems(undefined), []);
  assert.deepEqual(
    resolveTriedItems([{ name: '  שקשוקה ', priceIls: 52 }, { name: 'x' }]),
    [{ name: 'שקשוקה', priceIls: 52 }, { name: 'x' }],
  );
  assert.deepEqual(resolveTriedItems([{ name: '   ' }]), []); // empty names dropped
  assert.equal(resolveTriedItems([{ name: 'x', priceIls: -1 }]), null);
  assert.equal(resolveTriedItems('nope'), null);
});

test('resolveOpeningHours validates a 7-day grid', () => {
  const ok = [null, { open: '08:00', close: '17:00' }, null, null, null, null, null];
  assert.deepEqual(resolveOpeningHours(ok), ok);
  assert.equal(resolveOpeningHours([null]), null);            // wrong length
  assert.equal(
    resolveOpeningHours([{ open: '9:00', close: '17:00' }, null, null, null, null, null, null]),
    null,                                                      // not zero-padded
  );
  assert.equal(
    resolveOpeningHours([{ open: '18:00', close: '09:00' }, null, null, null, null, null, null]),
    null,                                                      // close <= open
  );
});

const A: CoffeeReview = { id:'a', placeName:'Alfa', createdAt:'2026-01-01T00:00:00Z', updatedAt:'',
  tomCoffeeRating:9, tomFoodRating:0, tomPastryRating:0, tomAtmosphereRating:0,
  tomerCoffeeRating:9, tomerFoodRating:0, tomerPastryRating:0, tomerAtmosphereRating:0,
  coffeePriceIls:18, priceLevel:'expensive', tags:['work'], area:'פלורנטין', photoUrl:'x' };
const B: CoffeeReview = { id:'b', placeName:'Bravo', createdAt:'2026-02-01T00:00:00Z', updatedAt:'',
  tomCoffeeRating:6, tomFoodRating:0, tomPastryRating:0, tomAtmosphereRating:0,
  tomerCoffeeRating:6, tomerFoodRating:0, tomerPastryRating:0, tomerAtmosphereRating:0,
  coffeePriceIls:14, priceLevel:'cheap', tags:[], area:'יפו' };
const C: CoffeeReview = { id:'c', placeName:'Charlie', createdAt:'2026-03-01T00:00:00Z', updatedAt:'',
  tomCoffeeRating:0, tomFoodRating:0, tomPastryRating:0, tomAtmosphereRating:0,
  tomerCoffeeRating:0, tomerFoodRating:0, tomerPastryRating:0, tomerAtmosphereRating:0 };

test('sortReviews by coffee desc puts the unrated place last', () => {
  const out = sortReviews([C, B, A], { metric:'coffee', perspective:'combined', dir:'desc' });
  assert.deepEqual(out.map((r) => r.id), ['a', 'b', 'c']);
});
test('sortReviews by coffeePrice asc keeps unknown-price places last', () => {
  const out = sortReviews([A, C, B], { metric:'coffeePrice', perspective:'combined', dir:'asc' });
  assert.deepEqual(out.map((r) => r.id), ['b', 'a', 'c']); // 14, 18, then no-price
});
test('sortReviews by value (price level) asc is cheapest-first, unset last', () => {
  // B cheap, A expensive, C unset
  const asc = sortReviews([A, C, B], { metric:'value', perspective:'combined', dir:'asc' });
  assert.deepEqual(asc.map((r) => r.id), ['b', 'a', 'c']);
  const desc = sortReviews([C, B, A], { metric:'value', perspective:'combined', dir:'desc' });
  assert.deepEqual(desc.map((r) => r.id), ['a', 'b', 'c']); // priciest first, unset last
});
test('filterReviews stacks predicates', () => {
  assert.deepEqual(filterReviews([A,B,C], { tags:['work'] }).map(r=>r.id), ['a']);
  assert.deepEqual(filterReviews([A,B,C], { areas:['יפו'] }).map(r=>r.id), ['b']);
  assert.deepEqual(filterReviews([A,B,C], { hasPhoto:true }).map(r=>r.id), ['a']);
  assert.deepEqual(filterReviews([A,B,C], { hideUnrated:true }).map(r=>r.id), ['a','b']);
  assert.deepEqual(filterReviews([A,B,C], { minCoffee:7 }).map(r=>r.id), ['a']);
  assert.deepEqual(filterReviews([A,B,C], { q:'brav' }).map(r=>r.id), ['b']);
});

test('controls round-trip through the URL, dropping defaults', () => {
  assert.equal(serializeControls(DEFAULT_CONTROLS), '');
  const c: CoffeeControls = { sort:{metric:'coffeePrice',perspective:'combined',dir:'asc'}, filters:{ tags:['work'], q:'x' } };
  const round = parseControls(serializeControls(c));
  assert.equal(round.sort.metric, 'coffeePrice');
  assert.equal(round.sort.dir, 'asc');
  assert.deepEqual(round.filters.tags, ['work']);
  assert.equal(round.filters.q, 'x');
});
test('parseControls ignores garbage and falls back to defaults', () => {
  const c = parseControls('sort=bogus&dir=sideways');
  assert.equal(c.sort.metric, 'coffee');
  assert.equal(c.sort.dir, 'desc');
});
test('computeStats picks the leaders', () => {
  const s = computeStats([A, B, C]);
  assert.equal(s.count, 3);
  assert.equal(s.kingOfCoffee?.name, 'Alfa');
  assert.equal(s.cheapest?.name, 'Bravo');
  assert.equal(s.avgPrice, 16); // (18+14)/2, C has no price
});

test('fuzzyMatch is a case-insensitive, whitespace-agnostic subsequence match', () => {
  assert.equal(fuzzyMatch('קפה בוקר', 'בוקר'), true);   // substring
  assert.equal(fuzzyMatch('קפה בוקר', 'קבוקר'), true);  // subsequence across the space
  assert.equal(fuzzyMatch('Cafe Boker', 'cafeboker'), true); // case + whitespace ignored
  assert.equal(fuzzyMatch('Origem', 'ogm'), true);      // dropped letters
  assert.equal(fuzzyMatch('Origem', ''), true);         // empty query matches all
  assert.equal(fuzzyMatch('Origem', 'xyz'), false);     // no match
  assert.equal(fuzzyMatch('Origem', 'megi'), false);    // right letters, wrong order
});
