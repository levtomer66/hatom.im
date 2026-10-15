import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOAD_TYPES,
  PRODUCTS,
  buildSteps,
  focusFrame,
  getLoadType,
  ltr,
  type LoadId,
} from '../laundry.ts';

const load = (id: LoadId) => {
  const t = getLoadType(id);
  assert.ok(t, id);
  return t;
};

test('temperatures and spins match the door notes', () => {
  const settings = Object.fromEntries(LOAD_TYPES.map((t) => [t.id, [t.tempC, t.spin]]));
  assert.deepEqual(settings, {
    white: [40, 600],
    black: [30, 600],
    towels: [60, 600],
    rugs: [60, 800],
    colored: [30, 600],
  });
});

test('every load gets a small cap of Dettol and of softener; only rugs skip scent beads', () => {
  for (const t of LOAD_TYPES) {
    assert.ok(t.doses.some((d) => d.product === 'dettol' && d.measure === 'small-cap'), t.id);
    assert.ok(t.doses.some((d) => d.product === 'softener' && d.measure === 'small-cap'), t.id);
    const beads = t.doses.some((d) => d.product === 'scent-beads' && d.measure === 'half-clear-cup');
    assert.equal(beads, t.id !== 'rugs', t.id);
  }
});

test('white uses 120 ml bleach, black uses the black detergent and no stain remover', () => {
  assert.ok(load('white').doses.some((d) => d.product === 'bleach' && d.measure === 'pink-120'));
  const black = load('black').doses.map((d) => d.product);
  assert.ok(black.includes('black-detergent'));
  assert.ok(!black.includes('detergent'));
  assert.ok(!black.includes('stain-remover'));
});

test('steps: drum first, then the drawer (II before blue), then the panel, ending on start', () => {
  const steps = buildSteps(load('white'));
  const ids = steps.map((s) => s.id);
  assert.equal(ids[0], 'load');
  assert.equal(ids.at(-1), 'start');
  const pos = (id: string) => ids.indexOf(id);
  const beads = steps.findIndex((s) => s.product === 'scent-beads');
  assert.ok(beads > pos('load') && beads < pos('close-door'));
  const doseSlots = steps.flatMap((s) => (s.product ? [PRODUCTS[s.product].slot] : []));
  assert.deepEqual(doseSlots, ['drum', 'main', 'main', 'softener', 'softener']);
  assert.ok(pos('close-drawer') < pos('power'));
  assert.deepEqual(ids.slice(-4), ['program', 'temp', 'spin', 'start']);
  assert.equal(new Set(ids).size, ids.length, 'step ids are unique');
});

test('step titles carry the exact measure, program and settings', () => {
  const titles = buildSteps(load('rugs')).map((s) => s.title);
  assert.ok(titles.includes('שמים פקק ורוד – 80 מ״ל מסיר כתמים'));
  assert.ok(titles.includes('לוחצים Spin עד 800'));
  assert.ok(titles.includes(`לוחצים Temp עד ${ltr('60°')}`));
  assert.ok(titles.some((t) => t.includes('Cotton')));
  assert.ok(buildSteps(load('colored')).some((s) => s.title.includes('Mixed Fabric')));
});

test('getLoadType rejects unknown ids', () => {
  assert.equal(getLoadType('purple'), undefined);
  assert.equal(getLoadType(null), undefined);
});

test('focusFrame centres the point when there is room', () => {
  const f = focusFrame(0.5, 0.5, 2, 1, 1);
  assert.deepEqual(f, { width: 200, left: -50, top: -50 });
});

test('focusFrame clamps at the edges so the photo always fills the frame', () => {
  const f = focusFrame(0, 1, 2, 1, 1);
  assert.equal(f.left, 0);
  assert.equal(f.top, -100);
});

test('focusFrame zooms a wide photo up to cover a taller frame', () => {
  const f = focusFrame(0.5, 0.5, 1, 2, 1);
  assert.equal(f.width, 200);
  assert.equal(f.top, 0);
});
