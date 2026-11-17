import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLiquid, listNutrition, namesAgree, nutritionOf, packGrams, parseOff, plausible, proteinCost, redLabels, type Nutrition,
} from '../shopping/nutrition.ts';

const nu = (o: Partial<Nutrition>): Nutrition => ({ kcal: null, p: null, c: null, s: null, f: null, sf: null, fib: null, na: null, by: 'off', ...o });

test('parseOff: per-100 g columns, sodium in mg, kJ and salt fallbacks', () => {
  // Bamba nougat, as Open Food Facts has it.
  assert.deepEqual(parseOff({ 'energy-kcal_100g': 529, proteins_100g: 10, carbohydrates_100g: 52, sugars_100g: 26, fat_100g: 30.4, 'saturated-fat_100g': 6.1, sodium_100g: 0.2 }),
    nu({ kcal: 529, p: 10, c: 52, s: 26, f: 30.4, sf: 6.1, na: 200 }));
  const fallback = parseOff({ energy_100g: '1046', salt_100g: '1.25' })!;
  assert.equal(fallback.kcal, 250);
  assert.equal(fallback.na, 500);
  assert.equal(parseOff({ product_name: 'x' }), null);
});

test('plausible: catches the spike\'s bad rows, passes real ones', () => {
  assert.equal(plausible(nu({ kcal: 529, p: 10, c: 52, s: 26, f: 30.4, sf: 6.1, na: 200 })), null); // Bamba nougat
  assert.equal(plausible(nu({ kcal: 0, p: 0, c: 0, s: 0, f: 0, na: 5 })), null); // Coke Zero
  assert.match(plausible(nu({ kcal: 534, na: 160_000 }))!, /sodium/); // Dubonim, 160 g sodium
  assert.match(plausible(nu({ kcal: 233, p: 2.9, c: 60, f: 30 }))!, /calories/); // Tortit's 233 kcal
  assert.match(plausible(nu({ c: 10, s: 20 }))!, /sugars/);
  assert.match(plausible(nu({ p: 60, c: 30, f: 30 }))!, /macros/);
});

test('namesAgree: a Hebrew name must share a word; other scripts pass', () => {
  assert.equal(namesAgree('במבה במילוי קרם נוגט', 'אסם השקעות', 'במבה נוגט'), true);
  assert.equal(namesAgree('קוקה קולה זירו בקבוק500מ', 'החברה המרכזית', 'קולה זירו'), true);
  assert.equal(namesAgree('שוקו יטבתה 1 ליטר', 'מחלבת יטבתה', 'שלגון וניל'), false);
  assert.equal(namesAgree('קליק חום לבן 65 גרם', 'יוניליוור', 'Klik'), true);
  assert.equal(namesAgree('x', 'y', null), true);
});

test('redLabels: strictly above the threshold; drinks use the liquid one; no label on produce', () => {
  const bissli = nu({ na: 700, s: 3.5, sf: 2 });
  assert.deepEqual(redLabels(bissli, false, 'snacks'), ['na']);
  assert.deepEqual(redLabels(nu({ na: 400, s: 10, sf: 4 }), false, 'snacks'), []); // equal = no label
  const juice = nu({ s: 9, na: 10 });
  assert.deepEqual(redLabels(juice, true, 'drinks'), ['s']);
  assert.deepEqual(redLabels(juice, false, 'pantry'), []); // 9 g as a solid is under 10
  assert.deepEqual(redLabels(nu({ s: 20 }), false, 'produce'), []);
  assert.equal(isLiquid('מיליליטר', 'drinks'), true);
  assert.equal(isLiquid('מיליליטר', 'dairy'), false); // yoghurt counts as solid
});

test('packGrams: grams, kilos, millilitres and litres; units are unknown', () => {
  assert.equal(packGrams(50, 'גרם'), 50);
  assert.equal(packGrams(1, 'קילוגרם'), 1000);
  assert.equal(packGrams(330, 'מיליליטר'), 330);
  assert.equal(packGrams(1.5, 'ליטר'), 1500);
  assert.equal(packGrams(12, 'יחידות'), null);
  assert.equal(packGrams(null, 'גרם'), null);
});

test('listNutrition: sums per line amount, counts what it cannot place', () => {
  const meta = {
    bamba: { nu: nu({ kcal: 534, p: 17.5, s: 3.2, na: 390 }), pack: 80, w: false, liquid: false, d: 'snacks' },
    tomato: { nu: nu({ kcal: 18, p: 0.9, s: 2.6, na: 5 }), pack: null, w: true, liquid: false, d: 'produce' },
    eggs: { nu: nu({ kcal: 143 }), pack: null, w: false, liquid: false, d: 'dairy' }, // sold by the unit: no grams
    soap: { nu: null, pack: 750, w: false, liquid: false, d: 'cleaning' },
    unknown: undefined,
  };
  const r = listNutrition([{ key: 'bamba', qty: 2 }, { key: 'tomato', qty: 1.5 }, { key: 'eggs', qty: 1 }, { key: 'soap', qty: 1 }, { key: 'unknown', qty: 1 }], meta);
  assert.equal(r.covered, 2);
  assert.equal(r.of, 4); // soap isn't food: not counted at all
  assert.deepEqual(r.missing, ['eggs', 'unknown']);
  assert.equal(Math.round(r.totals.kcal), Math.round(534 * 1.6 + 18 * 15));
  assert.equal(Math.round(r.totals.na), Math.round(390 * 1.6 + 5 * 15));
  assert.deepEqual(r.top.kcal.map((x) => x.key), ['bamba', 'tomato']);
  assert.deepEqual(r.red, []);
});

test('nutritionOf: reads a doc\'s nu, null when empty or absent', () => {
  assert.equal(nutritionOf({}), null);
  assert.equal(nutritionOf({ nu: { by: 'off' } }), null);
  assert.deepEqual(nutritionOf({ nu: { kcal: 60, p: 3.3, by: 'moh' } }), nu({ kcal: 60, p: 3.3, by: 'moh' }));
});

test('proteinCost: the price of the shown amount and its protein, per 100 g or per pack', () => {
  // Bamba nougat, 60 g at ₪4.00, 10 g protein per 100 g.
  assert.deepEqual(proteinCost(400, nu({ p: 10 }), 60, false, 100), { agorot: 667, protein: 10 });
  assert.deepEqual(proteinCost(400, nu({ p: 10 }), 60, false, 60), { agorot: 400, protein: 6 });
  // Chicken breast by weight, ₪39.90 a kg, 23 g per 100 g: 100 g = ₪3.99 for 23 g.
  assert.deepEqual(proteinCost(3990, nu({ p: 23 }), null, true, 100), { agorot: 399, protein: 23 });
  assert.equal(proteinCost(400, nu({ p: 1.5 }), 60, false, 100), null); // too little protein to say
  assert.equal(proteinCost(400, nu({ p: 10 }), null, false, 100), null); // no pack size
  assert.equal(proteinCost(null, nu({ p: 10 }), 60, false, 100), null);
});
