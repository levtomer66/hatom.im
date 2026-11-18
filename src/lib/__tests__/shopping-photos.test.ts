import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coreWords, photoByName, stem } from '../shopping/photos.ts';

test('Hebrew spellings and plurals of one product share a stem', () => {
  assert.equal(stem('עגבניה'), stem('עגבנייה'));
  assert.equal(stem('עגבניה'), stem('עגבניות'));
  assert.equal(stem('מלפפון'), stem('מלפפונים'));
  assert.equal(stem('שרי'), 'שרי'); // short words are left alone
});

test('core words drop sizes, units and packaging, and split numbers glued to words', () => {
  assert.deepEqual(coreWords('עגבניה מגי ארוזה (ק)'), [stem('עגבניה'), 'מגי']);
  assert.deepEqual(coreWords('קוטג%5מהדרין250גר'), [stem('קוטג'), stem('מהדרין')]);
});

test('an item borrows a photo only from the same product in the same department', () => {
  const got = photoByName([
    { key: 'w1', name: 'עגבנייה אשכולות | ישראל', d: 'produce', img: 'https://x/tomato' },
    { key: 'w2', name: 'מלפפון | ישראל', d: 'produce', img: 'https://x/cucumber' },
    { key: 'w3', name: 'קוקה קולה 1 ליטר', d: 'drinks', img: 'https://x/coke' },
    { key: 'c1', name: 'עגבניה', d: 'produce' },
    { key: 'c2', name: 'קוקה קולה 6*1.5 ליטר', d: 'drinks' },
    { key: 'c3', name: 'מלפפון במלח 540 גרם', d: 'deli' }, // other department
    { key: 'c4', name: 'מלפפון בייבי', d: 'produce' }, // a word the candidate lacks
    { key: 'c5', name: 'עגבניות מרוסקות', d: 'pantry' },
  ]);
  assert.equal(got.get('c1'), 'https://x/tomato');
  assert.equal(got.get('c2'), 'https://x/coke');
  assert.equal(got.has('c3'), false);
  assert.equal(got.has('c4'), false);
  assert.equal(got.has('c5'), false);
});
