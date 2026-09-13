import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COFFEE_CATEGORIES,
  resolveDisabledCategories,
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
