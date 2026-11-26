import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLine } from '../recipes/line.ts';
import { fToC, toGrams, unitKey } from '../recipes/units.ts';

test('digits, unit, name', () => assert.deepEqual(parseLine('2 כוסות קמח לבן'), { qty: 2, unit: 'כוס', name: 'קמח לבן' }));
test('mixed fraction', () => assert.equal(parseLine('1 1/2 כוסות חלב').qty, 1.5));
test('unicode fraction', () => assert.equal(parseLine('1½ כוס סוכר').qty, 1.5));
test('lone unicode', () => assert.deepEqual(parseLine('¾ כפית מלח'), { qty: 0.75, unit: 'כפית', name: 'מלח' }));
test('plain fraction', () => assert.deepEqual(parseLine('1/4 כוס שמן'), { qty: 0.25, unit: 'כוס', name: 'שמן' }));
test('hebrew word', () => assert.deepEqual(parseLine('חצי כוס שמן'), { qty: 0.5, unit: 'כוס', name: 'שמן' }));
test('hebrew number word', () => assert.deepEqual(parseLine('שתי ביצים'), { qty: 2, unit: null, name: 'ביצים' }));
test('no amount', () => assert.deepEqual(parseLine('מלח לפי הטעם'), { qty: null, unit: null, name: 'מלח לפי הטעם' }));
test('handful stays text', () => assert.deepEqual(parseLine('חופן פטרוזיליה'), { qty: null, unit: null, name: 'חופן פטרוזיליה' }));
test('pinch is no amount', () => assert.deepEqual(parseLine('קורט מלח'), { qty: null, unit: 'קורט', name: 'מלח' }));
test('grams', () => assert.deepEqual(parseLine('200 גרם חמאה'), { qty: 200, unit: 'גרם', name: 'חמאה' }));
test('ascii quote unit', () => assert.equal(parseLine('250 מ"ל שמנת מתוקה').unit, 'מ״ל'));
test('decimal', () => assert.equal(parseLine('0.5 ק״ג עוף').qty, 0.5));
test('garlic cloves', () => assert.deepEqual(parseLine('3 שיני שום'), { qty: 3, unit: 'שן', name: 'שום' }));
test('trims and empty', () => assert.deepEqual(parseLine('   '), { qty: null, unit: null, name: '' }));
test('number glued to unit-less name', () => assert.deepEqual(parseLine('2 בצלים'), { qty: 2, unit: null, name: 'בצלים' }));

test('unitKey aliases', () => {
  assert.equal(unitKey('כפות'), 'כף');
  assert.equal(unitKey('גר׳'), 'גרם');
  assert.equal(unitKey('ק"ג'), 'ק״ג');
  assert.equal(unitKey('קמח'), null);
});
test('toGrams flour cup', () => assert.equal(toGrams(1, 'כוס', 'קמח לבן'), 127));
test('toGrams water default density', () => assert.equal(toGrams(2, 'כף', 'מים'), 30));
test('toGrams weight exact', () => assert.equal(toGrams(0.5, 'ק״ג', 'עוף'), 500));
test('toGrams eggs', () => assert.equal(toGrams(3, null, 'ביצים'), 165));
test('toGrams garlic clove', () => assert.equal(toGrams(2, 'שן', 'שום'), 10));
test('toGrams unknown piece', () => assert.equal(toGrams(1, null, 'אננס'), null));
test('toGrams no qty', () => assert.equal(toGrams(null, null, 'מלח'), null));
test('toGrams pinch', () => assert.equal(toGrams(null, 'קורט', 'מלח'), null));
test('fToC', () => { assert.equal(fToC(350), 175); assert.equal(fToC(425), 220); });
