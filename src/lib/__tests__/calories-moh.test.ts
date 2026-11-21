import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFoodDocs, contentHash } from '../calories/moh.ts';

// Real rows from the data.gov.il datastore (2026-11-21), plus one impossible row (99999)
// and two hand-made weights (a 0 g one, and a doubled-space measure name).
const sample = JSON.parse(readFileSync(new URL('./fixtures/calories/moh-sample.json', import.meta.url), 'utf8'));
const docs = buildFoodDocs(sample.foods, sample.measures, sample.weights);
const byId = new Map(docs.map((d) => [d._id, d]));

test('keeps makor 1, 2 and 3; drops home recipes (4), survey rows (null) and impossible values', () => {
  assert.deepEqual(docs.map((d) => d._id).sort((a, b) => a - b), [160, 1561, 2581]);
});

test('maps the nutrients per 100 g, rounded like the shopping values', () => {
  assert.deepEqual(byId.get(1561)!.nu, { kcal: 143, p: 12.6, c: 0.7, s: 0.4, f: 9.5, sf: 3.1, fib: 0, na: 142, by: 'moh' });
  assert.equal(byId.get(1561)!.n, 'ביצה שלמה בלי קליפה');
});

test('units: no grams or kilograms, no 0 g weights, names cleaned, lightest first, one per name', () => {
  assert.deepEqual(byId.get(1561)!.units, [
    { name: 'יחידה קטנה מאד', g: 40 },
    { name: 'יחידה קטנה', g: 44 },
    { name: 'יחידה בינונית', g: 49.5 },
    { name: 'יחידה גדולה', g: 58 },
    { name: 'יחידה גדולה מאד', g: 62 },
  ]);
  assert.deepEqual(byId.get(160)!.units, [{ name: 'מנה', g: 330 }]);
});

test('contentHash is stable and changes with the content', () => {
  const { h, ...doc } = byId.get(2581)!;
  assert.equal(h, contentHash(doc));
  assert.equal(contentHash(doc), contentHash(structuredClone(doc)));
  assert.notEqual(contentHash(doc), contentHash({ ...doc, nu: { ...doc.nu, kcal: 535 } }));
});
