import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderGymsFile, slugify, validateGyms } from '../gym-config.ts';

const catalog = new Set(['lat-machine', 'low-row', 'dumbbells']);
const gym = (over: Record<string, unknown> = {}) => ({
  id: 'home-gym', name: 'Home Gym', nameHe: 'הבית', machines: [{ machineId: 'lat-machine' }], ...over,
});

test('slugify', () => {
  assert.equal(slugify('Holmes Place  Givatayim!'), 'holmes-place-givatayim');
  assert.equal(slugify('חדר כושר'), '');
});

test('valid gyms come back trimmed, with empty names dropped', () => {
  const r = validateGyms([gym({ name: '  Home Gym ', nameHe: '', machines: [
    { machineId: 'lat-machine', name: ' Lat ', nameHe: '' }, { machineId: 'dumbbells', name: '' },
  ] })], catalog);
  assert.ok(r.ok);
  assert.deepEqual(r.gyms, [{ id: 'home-gym', name: 'Home Gym', nameHe: 'Home Gym', machines: [
    { machineId: 'lat-machine', name: 'Lat' }, { machineId: 'dumbbells' },
  ] }]);
});

test('a serial number is kept trimmed, and dropped when empty', () => {
  const r = validateGyms([gym({ machines: [
    { machineId: 'lat-machine', serial: '  MG-A71-00123 ' }, { machineId: 'dumbbells', serial: ' ' },
  ] })], catalog);
  assert.ok(r.ok);
  assert.deepEqual(r.gyms[0].machines, [{ machineId: 'lat-machine', serial: 'MG-A71-00123' }, { machineId: 'dumbbells' }]);
  const long = validateGyms([gym({ machines: [{ machineId: 'lat-machine', serial: 'x'.repeat(41) }] })], catalog);
  assert.equal(long.ok, false);
});

test('bad gyms are refused with a reason', () => {
  const bad = (input: unknown) => {
    const r = validateGyms(input, catalog);
    assert.equal(r.ok, false);
    return r.ok ? '' : r.error;
  };
  assert.match(bad({}), /list/);
  assert.match(bad([]), /at least one gym/);
  assert.match(bad([gym({ id: 'Bad Id' })]), /id must/);
  assert.match(bad([gym(), gym()]), /share the id/);
  assert.match(bad([gym({ name: ' ' })]), /needs a name/);
  assert.match(bad([gym({ machines: [] })]), /at least one machine/);
  assert.match(bad([gym({ machines: [{ machineId: 'nope' }] })]), /unknown machine/);
  assert.match(bad([gym({ machines: [{ machineId: 'low-row' }, { machineId: 'low-row' }] })]), /twice/);
  assert.match(bad([gym({ name: 'x'.repeat(61) })]), /too long/);
});

test('the rendered file loads back as the same gyms', async () => {
  const gyms = [
    { id: 'a', name: 'Gym "A"', nameHe: 'חדר א׳', machines: [{ machineId: 'lat-machine', name: "O'Brien's lat" }] },
    { id: 'b', name: 'B', nameHe: 'ב', machines: [{ machineId: 'dumbbells' }, { machineId: 'low-row', nameHe: 'חתירה', serial: 'SN "7"' }] },
  ];
  const dir = mkdtempSync(path.join(tmpdir(), 'gyms-'));
  const file = path.join(dir, 'gyms.ts');
  writeFileSync(file, renderGymsFile(gyms));
  const mod = await import(pathToFileURL(file).href);
  assert.deepEqual(mod.GYMS, gyms);
});
