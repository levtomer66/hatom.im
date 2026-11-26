import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOVEMENTS, MERGED_AWAY, RENAMED_SINGLES, variantTagLabels } from '../../data/exercise-movements.ts';

// The library imports '@/…' aliases, so read its ids from source instead.
const libSrc = readFileSync(new URL('../../data/exercise-library.ts', import.meta.url), 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const libraryIds = new Set([...libSrc.matchAll(/^\s*(?:\{\s*)?id: '([^']+)'/gm)].map((m) => m[1]));

test('every variant is a real library exercise', () => {
  for (const m of MOVEMENTS) for (const v of m.variants) {
    assert.ok(libraryIds.has(v.exerciseId), `${m.id}: ${v.exerciseId}`);
  }
  for (const id of [...Object.keys(MERGED_AWAY), ...Object.values(MERGED_AWAY), ...Object.keys(RENAMED_SINGLES)]) {
    assert.ok(libraryIds.has(id), id);
  }
});

test('an exercise belongs to at most one movement, and merged ones to none', () => {
  const seen = new Map<string, string>();
  for (const m of MOVEMENTS) for (const v of m.variants) {
    assert.ok(!seen.has(v.exerciseId), `${v.exerciseId} in ${seen.get(v.exerciseId)} and ${m.id}`);
    assert.ok(!(v.exerciseId in MERGED_AWAY), `${v.exerciseId} is merged away`);
    seen.set(v.exerciseId, m.id);
  }
  for (const id of Object.keys(RENAMED_SINGLES)) assert.ok(!seen.has(id), `${id} is not single`);
});

test('variants of one movement are told apart by their chips', () => {
  for (const m of MOVEMENTS) {
    const labels = m.variants.map((v) => variantTagLabels(v.tags, 'en', m.id).join(' · '));
    assert.equal(new Set(labels).size, labels.length, `${m.id}: ${labels.join(' | ')}`);
    const he = m.variants.map((v) => variantTagLabels(v.tags, 'he', m.id).join(' · '));
    assert.equal(new Set(he).size, he.length, `${m.id} (he): ${he.join(' | ')}`);
  }
});

test('every demo photo is for a real exercise and exists on disk', async () => {
  const { DEMO_PHOTO_SOURCE } = await import('../../data/exercise-photos.ts');
  const { existsSync } = await import('node:fs');
  for (const id of Object.keys(DEMO_PHOTO_SOURCE)) {
    assert.ok(libraryIds.has(id), id);
    assert.ok(existsSync(new URL(`../../../public/workout/exercises/${id}.jpg`, import.meta.url)), `${id}.jpg`);
  }
});

test('how-to ids point at real exercises, and fallback frames exist', async () => {
  const { EXERCISEDB_ID } = await import('../../data/exercise-howto.ts');
  const { DEMO_PHOTO_SOURCE } = await import('../../data/exercise-photos.ts');
  const { existsSync } = await import('node:fs');
  for (const [id, edb] of Object.entries(EXERCISEDB_ID)) {
    assert.ok(libraryIds.has(id), id);
    assert.match(edb, /^[A-Za-z0-9]{7}$/, `${id}: ${edb}`);
  }
  for (const id of Object.keys(DEMO_PHOTO_SOURCE)) {
    assert.ok(existsSync(new URL(`../../../public/workout/exercises/${id}-end.jpg`, import.meta.url)), `${id}-end.jpg`);
  }
});
