import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { GYM_BARS } from '../../data/gym-bars.ts';
import { MERGED_AWAY, variantTagLabels } from '../../data/exercise-movements.ts';

const libSrc = readFileSync(new URL('../../data/exercise-library.ts', import.meta.url), 'utf8');
const libraryIds = new Set([...libSrc.matchAll(/^\s*(?:\{\s*)?id: '([^']+)'/gm)].map((m) => m[1]));

test('every bar has a unique id, a photo on disk and real exercises', () => {
  const ids = new Set<string>();
  for (const b of GYM_BARS) {
    assert.ok(!ids.has(b.id), `duplicate ${b.id}`);
    ids.add(b.id);
    assert.ok(b.name && b.nameHe, b.id);
    assert.ok(existsSync(new URL(`../../../public${b.photo}`, import.meta.url)), b.photo);
    assert.ok(b.exerciseIds.length > 0, `${b.id} has no exercises`);
    assert.equal(new Set(b.exerciseIds).size, b.exerciseIds.length, `${b.id} lists an exercise twice`);
    for (const e of b.exerciseIds) {
      assert.ok(libraryIds.has(e), `${b.id}: ${e} is not in the library`);
      assert.ok(!(e in MERGED_AWAY), `${b.id}: ${e} is merged away`);
    }
  }
});

test('the bars the picker is asked for are there', () => {
  for (const id of ['rope', 'v-bar', 'straight-bar', 'lat-bar', 'short-lat-bar', 'd-handle', 'olympic-bar', 'ez-bar', 'trap-bar']) {
    assert.ok(GYM_BARS.some((b) => b.id === id), id);
  }
});

test('skipAttachment drops only the attachment tag', () => {
  const tags = { equipment: 'cable', attachment: 'rope', side: 'single' } as const;
  const all = variantTagLabels(tags, 'en');
  const skipped = variantTagLabels(tags, 'en', undefined, { skipAttachment: true });
  assert.equal(skipped.length, all.length - 1);
  assert.deepEqual(variantTagLabels(tags, 'en', undefined, { skipEquipment: true, skipAttachment: true }).length, all.length - 2);
});
