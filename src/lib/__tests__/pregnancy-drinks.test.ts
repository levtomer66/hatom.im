import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cafLevel, cafPer100, drinkById, DRINKS, entryCaf, itemCaf, matchDrink, orderDrink } from '../pregnancy/drinks.ts';
import { foodWarning } from '../pregnancy/safety.ts';

const order = (o: Record<string, unknown> = {}) => ({
  drink: 'cappuccino', milk: 'regular', sugar: 'none', source: 'tomer-coffee', capsule: 'vanille', vanillaPumps: 0, caramelPumps: 0, ...o,
}) as Parameters<typeof orderDrink>[0];

test('built-in drinks carry the sourced values', () => {
  assert.equal(drinkById('hafuch-small')?.mg, 65);
  assert.equal(drinkById('hafuch-large')?.mg, 130);
  assert.equal(drinkById('zero-glass')?.mg, 25);
  assert.equal(drinkById('zero-can')?.mg, 33);
  assert.equal(drinkById('nope'), null);
  assert.equal(new Set(DRINKS.map((d) => d.id)).size, DRINKS.length);
  assert.ok(drinkById('black')?.warn, 'MoH: avoid black/Turkish coffee');
  assert.ok(drinkById('energy')?.warn, 'MoH: avoid energy drinks');
});

test('matchDrink: names and everyday words', () => {
  assert.equal(matchDrink('הפוך גדול')?.id, 'hafuch-large');
  assert.equal(matchDrink('הפוך')?.id, 'hafuch-small');
  assert.equal(matchDrink('כוס זירו')?.id, 'zero-glass');
  assert.equal(matchDrink('קפוצ׳ינו')?.id, 'hafuch-small');
  assert.equal(matchDrink('אספרסו כפול')?.id, 'espresso-double');
  assert.equal(matchDrink('מיץ תפוזים'), null);
});

test('cafPer100: name rules, longest stem wins', () => {
  assert.equal(cafPer100('קוקה קולה זירו 1.5 ליטר'), 10);
  assert.equal(cafPer100('קוקה קולה דיאט פחית'), 13);
  assert.equal(cafPer100('רד בול משקה אנרגיה'), 32);
  assert.equal(cafPer100('מים מינרליים'), null);
  assert.equal(cafPer100('ספרייט זירו'), null);
  assert.ok((cafPer100('קפה נטול קפאין') ?? 99) <= 2);
  assert.equal(cafPer100('שוקולד חלב נטול סוכר'), null);
});

test('orderDrink: machine capsule vs café, milk, sugar and syrup', () => {
  const machine = orderDrink(order());
  assert.equal(machine.mg, drinkById('capsule')?.mg);
  const black = orderDrink(order({ drink: 'espresso', milk: 'none' }));
  assert.ok(black.nu.kcal <= 5);
  assert.ok(machine.nu.kcal > black.nu.kcal + 50, 'milk counted');
  const sweet = orderDrink(order({ sugar: '2', vanillaPumps: 1 }));
  assert.equal(sweet.nu.kcal, machine.nu.kcal + 32 + 20);
  assert.equal(orderDrink(order({ source: 'boulangerie' })).drink.id, 'hafuch-small');
  assert.equal(orderDrink(order({ source: 'boulangerie', drink: 'lungo', milk: 'none' })).drink.id, 'espresso-double');
  assert.equal(orderDrink(order({ source: 'cafe-beit', drink: 'iced-coffee' })).drink.id, 'iced');
});

test('cafLevel thresholds', () => {
  assert.equal(cafLevel(149, 200), 'ok');
  assert.equal(cafLevel(150, 200), 'warn');
  assert.equal(cafLevel(200, 200), 'warn');
  assert.equal(cafLevel(201, 200), 'over');
});

test('foodWarning: pregnancy stems', () => {
  assert.ok(foodWarning('סושי סלמון'));
  assert.ok(foodWarning('בירה גולדסטאר'));
  assert.equal(foodWarning('בירה שחורה מאלט'), null);
  assert.equal(foodWarning('אורז להכנת סושי'), null);
  assert.equal(foodWarning('סושי מגבות אריזת שישייה'), null);
  assert.equal(foodWarning('סושי עוף 80 גרם'), null);
  assert.equal(foodWarning('חומץ יין אדום'), null);
  assert.ok(foodWarning('סושי סלמון 8 יח׳'));
  assert.ok(foodWarning('כבד עוף'));
  assert.ok(foodWarning('גבינת ברי'));
  assert.equal(foodWarning('גבינה צהובה'), null);
  assert.equal(foodWarning('סלט ירקות'), null);
});

test('entryCaf: drinks, products by name, meals per portion, quick none', () => {
  assert.equal(entryCaf({ ref: { kind: 'drink', key: 'hafuch-large' }, name: 'x', unit: { g: 350 }, qty: 2 }), 260);
  assert.equal(entryCaf({ ref: { kind: 'product', key: '1' }, name: 'קוקה קולה זירו', unit: { g: 1 }, qty: 500 }), 50);
  assert.equal(entryCaf({ ref: { kind: 'product', key: '1' }, name: 'לחם', unit: { g: 1 }, qty: 50 }), undefined);
  assert.equal(entryCaf({ ref: { kind: 'meal', key: 'm' }, name: 'x', unit: { g: 300 }, qty: 2 }, 40), 80);
  assert.equal(entryCaf({ ref: { kind: 'quick', key: null }, name: 'קולה', unit: { g: 0 }, qty: 1 }), undefined);
  assert.equal(itemCaf({ ref: { kind: 'drink', key: 'espresso' }, name: 'x', grams: 60 }), 130);
  assert.ok(DRINKS.every((d) => d.g > 0));
});
