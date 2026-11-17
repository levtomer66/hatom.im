import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLiquid, listNutrition, namesAgree, nutritionGrade, nutritionOf, packGrams, parseOff, plausible, proteinGramCost, proteinValue, redLabels, type Nutrition,
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

test('proteinGramCost: average agorot per 1 g of protein, from one pack\'s (or 1 kg\'s) price', () => {
  const r = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  // Tara cottage 5%, 250 g at ₪6.90, 10.1 g protein per 100 g → 25.25 g → 27.3 agorot.
  assert.equal(r(proteinGramCost(690, nu({ p: 10.1 }), 250, false)), 27.3);
  // Bamba nougat, 60 g at ₪4.00, 10 g per 100 g → 6 g → 66.7 agorot.
  assert.equal(r(proteinGramCost(400, nu({ p: 10 }), 60, false)), 66.7);
  // Chicken breast by weight, ₪39.90 a kg, 23 g per 100 g → 230 g → 17.3 agorot.
  assert.equal(r(proteinGramCost(3990, nu({ p: 23 }), null, true)), 17.3);
  assert.equal(proteinGramCost(400, nu({ p: 1.5 }), 60, false), null); // too little protein to say
  assert.equal(proteinGramCost(400, nu({ p: 10 }), null, false), null); // no pack size
  assert.equal(proteinGramCost(null, nu({ p: 10 }), 60, false), null);
});

test('proteinValue: the owner\'s bands, from very good to expensive', () => {
  assert.equal(proteinValue(15).label, 'משתלם מאוד'); // chicken breast
  assert.equal(proteinValue(20).label, 'משתלם מאוד');
  assert.equal(proteinValue(27.3).label, 'משתלם'); // cottage
  assert.equal(proteinValue(35).label, 'יקר יחסית'); // protein pudding
  assert.equal(proteinValue(66.7).label, 'יקר'); // Bamba nougat
});

test('nutritionGrade: green without red labels, yellow with one, red with more', () => {
  assert.equal(nutritionGrade(nu({ na: 50, s: 4.6, sf: 2 }), false, 'dairy').tone, 'green'); // milk-like
  assert.deepEqual(nutritionGrade(nu({ na: 700, s: 3.5, sf: 2 }), false, 'snacks'), { tone: 'yellow', text: 'סימון אדום אחד: נתרן' }); // Bissli
  assert.equal(nutritionGrade(nu({ na: 200, s: 26, sf: 5.2 }), false, 'snacks').tone, 'red'); // Bamba nougat
  assert.equal(nutritionGrade(nu({ s: 20 }), false, 'produce').tone, 'green');
});
