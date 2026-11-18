import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPARTMENTS, DEPARTMENT_IDS, departmentOf, departmentOfCategory } from '../shopping/departments.ts';

test('every rule points at a listed department', () => {
  assert.equal(DEPARTMENT_IDS.size, DEPARTMENTS.length);
  for (const n of ['במבה', 'חלב 3%', 'נייר טואלט', 'אורז']) assert.ok(DEPARTMENT_IDS.has(departmentOf(n)!), n);
});

test('the longest matching word wins', () => {
  assert.equal(departmentOf('פלפל שחור גרוס'), 'pantry');
  assert.equal(departmentOf('פלפל אדום'), 'produce');
  assert.equal(departmentOf('אורז לבן פרסי'), 'pantry');
  assert.equal(departmentOf('פירורי לחם'), 'pantry');
  assert.equal(departmentOf('לחם אחיד פרוס'), 'bakery');
  assert.equal(departmentOf('שוקולד חלב'), 'snacks');
  assert.equal(departmentOf('חלב 3% בקרטון'), 'dairy');
  assert.equal(departmentOf('נוזל כלים לימון'), 'cleaning');
  assert.equal(departmentOf('לחמניות המבורגר'), 'bakery');
});

test('pets and baby beat the general match; one-letter prefixes are ignored', () => {
  assert.equal(departmentOf('חטיף כלבים ברונו פילה'), 'pets');
  assert.equal(departmentOf('מגבונים לתינוק'), 'baby');
});

test('a source category path places its items by the aisle, not a word in the leaf', () => {
  assert.equal(departmentOfCategory('פירות וירקות / ירקות'), 'produce');
  assert.equal(departmentOfCategory('תה וקפה / קפה ושוקו'), 'coffee');
  assert.equal(departmentOfCategory('חטיפים מלוחים וקרקרים / חטיפים מלוחים'), 'snacks');
  assert.equal(departmentOfCategory('מזווה / שמן, חומץ ומיץ לימון'), 'pantry');
  assert.equal(departmentOfCategory('מזווה / דבש ריבות וממרחים'), 'breakfast');
  assert.equal(departmentOfCategory('חמאה וגבינות / גבינות פרוסות'), 'dairy');
  assert.equal(departmentOfCategory('‫משקאות קלים 🧃'), 'drinks');
  assert.equal(departmentOfCategory('משקאות אלכוהול / בירות'), 'alcohol');
  assert.equal(departmentOfCategory('ימי הולדת 🎂'), null);
});

test('unknown text places nothing', () => {
  assert.equal(departmentOf('מבצעי השבוע'), null);
});

test('canned, pickled and dried produce is not in the produce aisle', () => {
  assert.equal(departmentOf('עגבניות מרוסקות יכין'), 'pantry');
  assert.equal(departmentOf('מלפפון במלח 18-25 540גרם'), 'deli');
  assert.equal(departmentOf('לימונית מיץ לימון200מ"ל'), 'pantry');
  assert.equal(departmentOf('אננס חתוך 227גרם'), 'pantry');
  assert.equal(departmentOf('תפוח עץ מיובש 160 גר'), 'snacks');
  assert.equal(departmentOf('עגבניה'), 'produce');
});
