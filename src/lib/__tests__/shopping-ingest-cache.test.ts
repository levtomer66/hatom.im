import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  RAW_RETENTION_DAYS, REQUEST_GAP_MS, cachePaths, ensureCacheDirs, fetchCached, pruneRaw, readJson, runLog, toXml, writeJson,
} from '../shopping/ingest/cache.ts';

const tmp = () => mkdtempSync(join(tmpdir(), 'hatom-cache-'));

test('cachePaths: everything hangs off one root; SHOPPING_CACHE_DIR wins over ~/.cache/hatom-shopping', () => {
  const p = cachePaths({ SHOPPING_CACHE_DIR: '/tmp/x' });
  assert.deepEqual(p, {
    root: '/tmp/x', raw: '/tmp/x/raw', state: '/tmp/x/state', storeState: '/tmp/x/state/stores', logs: '/tmp/x/logs', places: '/tmp/x/places',
  });
  assert.match(cachePaths({}).root, /\.cache\/hatom-shopping$/);
  const root = tmp();
  ensureCacheDirs(cachePaths({ SHOPPING_CACHE_DIR: root }));
  for (const d of ['raw', 'state/stores', 'logs']) assert.ok(existsSync(join(root, d)), d);
  assert.equal(existsSync(join(root, 'places')), false); // the owner's folder: never created for them
});

test('readJson / writeJson: a missing file is the fallback; the indent is the file\'s format', () => {
  const dir = tmp();
  assert.deepEqual(readJson(join(dir, 'nope.json'), { a: 1 }), { a: 1 });
  writeJson(join(dir, 'compact.json'), { a: [1, 2] });
  writeJson(join(dir, 'readable.json'), { a: [1, 2] }, 1);
  assert.equal(readFileSync(join(dir, 'compact.json'), 'utf8'), '{"a":[1,2]}');
  assert.equal(readFileSync(join(dir, 'readable.json'), 'utf8'), '{\n "a": [\n  1,\n  2\n ]\n}');
  assert.deepEqual(readJson(join(dir, 'readable.json'), null), { a: [1, 2] });
});

test('fetchCached: a file name already in the raw cache is never downloaded again', async () => {
  const raw = join(tmp(), 'raw');
  let downloads = 0;
  const download = async () => {
    downloads++;
    return new Uint8Array([1, 2, 3]);
  };
  assert.deepEqual([...(await fetchCached(raw, 'yohananof', { name: 'PriceFull-1.gz' }, download))], [1, 2, 3]);
  assert.deepEqual([...(await fetchCached(raw, 'yohananof', { name: 'PriceFull-1.gz' }, download))], [1, 2, 3]);
  assert.equal(downloads, 1);
  assert.deepEqual([...readFileSync(join(raw, 'yohananof', 'PriceFull-1.gz'))], [1, 2, 3]);
});

test('pruneRaw: only raw files older than the retention go', () => {
  const raw = join(tmp(), 'raw');
  mkdirSync(join(raw, 'yohananof'), { recursive: true });
  mkdirSync(join(raw, 'wolt'), { recursive: true });
  const now = Date.parse('2026-11-18T10:00:00Z');
  const file = (chain: string, name: string, ageDays: number) => {
    const p = join(raw, chain, name);
    writeFileSync(p, 'x');
    const t = (now - ageDays * 86_400_000) / 1000;
    utimesSync(p, t, t);
    return p;
  };
  const old = file('yohananof', 'old.gz', RAW_RETENTION_DAYS + 1);
  const kept = [file('yohananof', 'week.gz', RAW_RETENTION_DAYS - 1), file('wolt', 'today.json', 0)];
  const lines: string[] = [];
  assert.equal(pruneRaw(raw, (m) => lines.push(m), now), 1);
  assert.equal(existsSync(old), false);
  for (const p of kept) assert.ok(existsSync(p), p);
  assert.deepEqual(lines, ['pruned 1 raw files older than 7 days']);
  assert.equal(pruneRaw(raw, (m) => lines.push(m), now), 0);
  assert.equal(lines.length, 1); // nothing pruned, nothing said
});

test('toXml: gzip or plain bytes, decoded to text', () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><Root><Name>יוחננוף</Name></Root>';
  assert.equal(toXml(new Uint8Array(Buffer.from(xml))), xml);
  assert.equal(toXml(new Uint8Array(gzipSync(xml))), xml);
});

test('runLog: every line goes to the console and to the run\'s log file', () => {
  const logs = tmp();
  const out: string[] = [];
  const run = runLog(logs, new Date('2026-11-18T10:00:00.123Z'), { log: (m) => out.push(m), warn: (m) => out.push(m) });
  run.log('one');
  run.warn('two');
  assert.equal(run.id, '2026-11-18T10-00-00-123Z');
  assert.equal(run.file, join(logs, '2026-11-18T10-00-00-123Z.log'));
  assert.deepEqual(out, ['one', '! two']);
  assert.equal(readFileSync(run.file, 'utf8'), 'one\nWARN two\n');
});

test('every host is asked at most once per 1.5 s', () => {
  assert.equal(REQUEST_GAP_MS, 1500);
});
