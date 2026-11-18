import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIngestFlags } from '../shopping/ingest/flags.ts';

test('parseIngestFlags: nothing asked = every chain, a full fetch-and-write run that prunes the raw cache', () => {
  assert.deepEqual(parseIngestFlags([]), { chains: null, maxStores: null, dryRun: false, full: false, offline: false, pruneRaw: true });
});

test('parseIngestFlags: --chains is a comma list; --full and --offline are switches', () => {
  const f = parseIngestFlags(['--chains', 'yohananof, shufersal,wolt', '--full', '--offline']);
  assert.deepEqual(f.chains, ['yohananof', 'shufersal', 'wolt']);
  assert.equal(f.full, true);
  assert.equal(f.offline, true);
});

test('parseIngestFlags: a dry run or an offline run never prunes the raw cache', () => {
  assert.equal(parseIngestFlags(['--dry-run']).pruneRaw, false);
  assert.equal(parseIngestFlags(['--offline']).pruneRaw, false);
  assert.equal(parseIngestFlags(['--offline', '--dry-run']).pruneRaw, false);
  assert.equal(parseIngestFlags(['--full']).pruneRaw, true);
});

test('parseIngestFlags: --max-stores is a sampling smoke run, so it needs --dry-run', () => {
  assert.equal(parseIngestFlags(['--max-stores', '2', '--dry-run']).maxStores, 2);
  assert.throws(() => parseIngestFlags(['--max-stores', '2']), /--max-stores.*--dry-run/);
  assert.throws(() => parseIngestFlags(['--max-stores', '2', '--offline']), /--max-stores.*--dry-run/);
  for (const bad of ['0', '-1', 'two', '1.5']) {
    assert.throws(() => parseIngestFlags(['--max-stores', bad, '--dry-run']), /--max-stores/, bad);
  }
});

test('parseIngestFlags: the removed flags are refused with the reason, not ignored', () => {
  assert.throws(() => parseIngestFlags(['--all-stores']), /--all-stores was removed/);
  assert.throws(() => parseIngestFlags(['--cities', 'tel-aviv']), /--cities was removed/);
  assert.throws(() => parseIngestFlags(['--cities=tel-aviv']), /--cities was removed/);
  assert.throws(() => parseIngestFlags(['--nope']), /nope/);
});
