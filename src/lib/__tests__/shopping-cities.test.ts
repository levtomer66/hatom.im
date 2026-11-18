// Jerusalem and Mevaseret Zion (added 2026-11-18). The cases are real rows
// from the chains' Stores files: many cities have a "שד' ירושלים" street, so
// only the CBS code, a Hebrew City value, or (City 0) the store name counts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cityOf } from '../shopping/cities.ts';

test('cityOf finds the chosen Jerusalem and Mevaseret stores', () => {
  assert.equal(cityOf({ city: '3000', name: 'היפר ירושלים תלפיות' }), 'jerusalem'); // carrefour 128
  assert.equal(cityOf({ city: '3000', name: 'תלפיות' }), 'jerusalem'); // rami-levy 1
  assert.equal(cityOf({ city: '1015', name: 'מבשרת' }), 'mevaseret-zion'); // rami-levy 7
  assert.equal(cityOf({ city: 'ירושלים', name: '202 בית הכרם ירושלים' }), 'jerusalem'); // mahsani-hashuk 202
  assert.equal(cityOf({ city: 'מבשרת ציון', name: 'מבשרת ציון' }), 'mevaseret-zion'); // victory 38
  assert.equal(cityOf({ city: '0', name: 'ירושלים תלפיות' }), 'jerusalem'); // yohananof 20
  assert.equal(cityOf({ city: '', name: 'סניף י-ם' }), 'jerusalem');
});

test('cityOf keeps Jerusalem streets elsewhere out of Jerusalem', () => {
  assert.equal(cityOf({ city: '9000', name: "קרפור סיטי הצרכניה רובע ט ב'ש" }), 'beer-sheva'); // address "42 שדרות י-ם"
  assert.equal(cityOf({ city: '7400', name: 'קרפור סיטי ירושלים נתניה' }), null); // code wins over the name
  assert.equal(cityOf({ city: '9200', name: 'דיל בית שאן-ירושלים הבירה' }), null);
  assert.equal(cityOf({ city: '0', name: 'רמלה' }), null); // yohananof 12, address "שדרות ירושלים …"
  assert.equal(cityOf({ city: 'קרית מוצקין', name: 'מוצקין' }), null); // victory 34
  assert.equal(cityOf({ city: 'גבעז זאב', name: '207 גבעת זאב- ירושלים' }), null); // a Hebrew City value wins too
  // City 0 and a street in the name: city-market 11 is on ירושלים 120 in Rishon LeZion.
  assert.equal(cityOf({ city: '0', name: 'ראשל"צ ירושלים 120' }), null);
});
