import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COFFEE_AREAS,
  COFFEE_CATEGORIES,
  COFFEE_TAGS,
  isValidArea,
  priceTier,
  resolveDisabledCategories,
  resolveTags,
  reviewerGap,
  scoreReview,
  type CoffeeCategory,
  type ScorableReview,
} from '../../types/coffee.ts';

// tom:   8, 4, 7, 9  → all four 7.0    · without food 8.0
// tomer: 9, 2, 6, 9  → all four 6.5    · without food 8.0
const RATED: ScorableReview = {
  tomCoffeeRating: 8,
  tomFoodRating: 4,
  tomAtmosphereRating: 7,
  tomPriceRating: 9,
  tomerCoffeeRating: 9,
  tomerFoodRating: 2,
  tomerAtmosphereRating: 6,
  tomerPriceRating: 9,
};

const byId = (s: ReturnType<typeof scoreReview>, id: CoffeeCategory) =>
  s.categories.find((c) => c.id === id)!;

test('the registry is the five categories in display order', () => {
  assert.deepEqual(
    COFFEE_CATEGORIES.map((c) => c.id),
    ['coffee', 'food', 'pastry', 'atmosphere', 'price'],
  );
});

test('regression: a fully-rated review with nothing disabled scores as it did before', () => {
  const s = scoreReview(RATED);
  assert.equal(s.tom, 7);
  assert.equal(s.tomer, 6.5);
  assert.equal(s.combined, 6.75);
  assert.equal(byId(s, 'coffee').combined, 8.5);
  assert.equal(byId(s, 'food').combined, 3);
  assert.equal(s.categories.length, 5);
  assert.ok(s.categories.every((c) => !c.disabled));
});

test('a legacy document with no disabledCategories field is identical to an empty array', () => {
  assert.deepEqual(scoreReview(RATED), scoreReview({ ...RATED, disabledCategories: [] }));
});

test('disabling food drops it from both reviewers and from the combined score', () => {
  const s = scoreReview({ ...RATED, disabledCategories: ['food'] });
  assert.equal(s.tom, 8);
  assert.equal(s.tomer, 8);
  assert.equal(s.combined, 8);

  const food = byId(s, 'food');
  assert.equal(food.disabled, true);
  assert.equal(food.tom, 0);
  assert.equal(food.tomer, 0);
  assert.equal(food.combined, 0);

  // The grid stays five wide so the card can render the ring in place.
  assert.equal(s.categories.length, 5);
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
  assert.equal(s.tom, 8);      // 8, 7, 9 — the 0 is skipped
  assert.equal(s.tomer, 6.5);  // unchanged
  assert.equal(s.combined, 7.25);

  const food = byId(s, 'food');
  assert.equal(food.disabled, false);  // NOT the same state as disabled
  assert.equal(food.combined, 2);      // only Tomer's 2 counts
});

test('all five disabled scores as unrated', () => {
  const s = scoreReview({
    ...RATED,
    disabledCategories: ['coffee', 'food', 'pastry', 'atmosphere', 'price'],
  });
  assert.equal(s.tom, 0);
  assert.equal(s.tomer, 0);
  assert.equal(s.combined, 0);
  assert.equal(s.categories.length, 5);
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
  assert.deepEqual(resolveDisabledCategories(['price', 'coffee']), ['price', 'coffee']);

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
  // Tom's overall is still the mean of his 4 rated categories (8,4,7,9) = 7.0
  assert.equal(s.tom, 7);
});

test('a rated pastry participates in the average', () => {
  const s = scoreReview({ ...RATED, tomPastryRating: 10, tomerPastryRating: 10 });
  // Tom now averages 8,4,10,7,9 = 7.6
  assert.equal(Number(s.tom.toFixed(2)), 7.6);
  assert.equal(byId(s, 'pastry').combined, 10);
});

test('disabling pastry excludes it even when rated', () => {
  const s = scoreReview({
    ...RATED, tomPastryRating: 1, tomerPastryRating: 1,
    disabledCategories: ['pastry'],
  });
  assert.equal(byId(s, 'pastry').disabled, true);
  assert.equal(s.tom, 7); // back to the 4-category average
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
