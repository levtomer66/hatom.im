import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuzzySearch, normalize, editDistance } from '../exercise-search.ts';
import { GYMS, GYM_MACHINES, machinesForGym } from '../../data/gym-machines.ts';

const docs = [
  { id: 'wide-grip-lat-pulldown', texts: ['Wide Grip Lat Pulldown', 'פולי עליון רחב', 'back', 'Lat Machine', 'פולי'] },
  { id: 'tricep-pushdown', texts: ['Tricep Pushdown', 'triceps', 'Cable Station', 'cable', 'פולי'] },
  { id: 'bench-press', texts: ['Bench Press', 'לחיצת חזה', 'chest'] },
  { id: 'squat', texts: ['Squat', 'סקוואט', 'legs', 'quads'] },
];

test('normalize strips geresh and final letters', () => {
  assert.equal(normalize('סמית׳'), 'סמית');
  assert.equal(normalize('כתפיים'), 'כתפיימ');
  assert.equal(normalize('Lat-Pulldown'), 'lat pulldown');
});

test('editDistance', () => {
  assert.equal(editDistance('pulldwn', 'pulldown', 2), 1);
  assert.ok(editDistance('squat', 'bench', 1) > 1);
});

test('typo still finds the exercise', () => {
  assert.equal(fuzzySearch('pulldwon', docs)[0], 'wide-grip-lat-pulldown');
  assert.equal(fuzzySearch('sqat', docs)[0], 'squat');
});

test('muscle and synonym words match', () => {
  assert.deepEqual(fuzzySearch('chest', docs), ['bench-press']);
  assert.deepEqual(fuzzySearch('pecs', docs), ['bench-press']);
  assert.ok(fuzzySearch('pulley', docs).includes('tricep-pushdown'));
});

test('Hebrew slang matches machine words', () => {
  const r = fuzzySearch('פולי', docs);
  assert.ok(r.includes('wide-grip-lat-pulldown'));
  assert.ok(r.includes('tricep-pushdown'));
});

test('Hebrew synonym with a final letter', () => {
  assert.ok(fuzzySearch('רגליים', docs).includes('squat'));
});

test('every query word must match', () => {
  assert.deepEqual(fuzzySearch('lat chest', docs), []);
});

test('gym data references only known machines, once each', () => {
  const ids = new Set(GYM_MACHINES.map((m) => m.id));
  assert.ok(GYMS.length > 0);
  assert.equal(new Set(GYMS.map((g) => g.id)).size, GYMS.length, 'gym ids are unique');
  for (const g of GYMS) {
    for (const s of g.machines) assert.ok(ids.has(s.machineId), `${g.id}: ${s.machineId}`);
    assert.equal(new Set(g.machines.map((s) => s.machineId)).size, g.machines.length, `${g.id} lists a machine twice`);
  }
  assert.equal(machinesForGym('nope')[0].id, GYMS[0].machines[0].machineId);
});

test("machinesForGym uses the gym's own names, falling back to the catalog", () => {
  const gyms = [{ id: 'x', name: 'X', nameHe: 'X', machines: [
    { machineId: 'lat-machine', name: 'Lat by the window', nameHe: 'הפולי ליד החלון' },
    { machineId: 'low-row', name: 'Row' },
    { machineId: 'dumbbells' },
    { machineId: 'gone-machine' },
  ] }];
  const [a, b, c, ...rest] = machinesForGym('x', gyms);
  assert.equal(a.name, 'Lat by the window');
  assert.equal(a.nameHe, 'הפולי ליד החלון');
  assert.equal(b.name, 'Row');
  assert.equal(b.nameHe, GYM_MACHINES.find((m) => m.id === 'low-row')!.nameHe, 'Hebrew falls back to the catalog, not the English name');
  const catalog = GYM_MACHINES.find((m) => m.id === 'dumbbells')!;
  assert.equal(c.name, catalog.name);
  assert.equal(c.nameHe, catalog.nameHe);
  assert.equal(rest.length, 0, 'unknown machine ids are skipped');
  assert.deepEqual(machinesForGym('x', []), []);
});

test('every catalog machine has a brand, a real photo and real exercises', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const libSrc = readFileSync(new URL('../../data/exercise-library.ts', import.meta.url), 'utf8');
  const libraryIds = new Set([...libSrc.matchAll(/^\s*(?:\{\s*)?id: '([^']+)'/gm)].map((m) => m[1]));
  const ids = new Set<string>();
  for (const m of GYM_MACHINES) {
    assert.ok(!ids.has(m.id), `duplicate ${m.id}`);
    ids.add(m.id);
    assert.ok(['technogym', 'matrix', 'generic'].includes(m.brand), m.id);
    if (m.photo) assert.ok(existsSync(new URL(`../../../public${m.photo}`, import.meta.url)), m.photo);
    assert.ok(m.exerciseIds.length > 0, `${m.id} has no exercises`);
    for (const e of m.exerciseIds) assert.ok(libraryIds.has(e), `${m.id}: ${e}`);
  }
});
