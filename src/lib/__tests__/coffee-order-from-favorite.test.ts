import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderDtoFromFavorite } from '../../types/coffee-order.ts';
import type { CoffeeDrinkConfig } from '../../types/coffee-order.ts';

const sample: CoffeeDrinkConfig = {
  drink: 'cappuccino',
  milk: 'oat',
  sugar: '2',
  source: 'tomer-coffee',
  capsule: 'caramel',
  glassColor: 'green',
  vanillaPumps: 1,
  caramelPumps: 3,
  notes: 'extra hot',
};

test('carries every drink-config field through unchanged', () => {
  const dto = orderDtoFromFavorite(sample);
  for (const k of Object.keys(sample) as (keyof CoffeeDrinkConfig)[]) {
    assert.deepEqual(dto[k], sample[k]);
  }
});

test('a one-tap order is always delivery "now" with no scheduledAt', () => {
  const dto = orderDtoFromFavorite(sample);
  assert.equal(dto.deliveryType, 'now');
  assert.equal('scheduledAt' in dto, false);
});
