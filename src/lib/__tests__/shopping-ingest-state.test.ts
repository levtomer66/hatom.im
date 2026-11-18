import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { CanonItem } from '../shopping/normalize.ts';
import {
  PARSER_VERSION, assignKeys, manualStores, replaceFetched, stateStore, type SavedStoreState, type StoreRecord,
} from '../shopping/ingest/state.ts';

const item = (key: string, priceAgorot: number): CanonItem => ({
  key, code: key, barcode: true, name: key, manufacturer: '', unitQty: '', quantity: null, unitOfMeasure: '', weighted: false, priceAgorot,
});
const saved = (over: Partial<SavedStoreState> = {}): SavedStoreState => ({
  parser: PARSER_VERSION, chainId: '7290803800003', storeId: '40', priceFile: 'PriceFull-40.gz', promoFile: null, items: [item('7290000000011', 500)], promos: [], ...over,
});
const yo40 = { chainId: '7290803800003', storeId: '40', chainSlug: 'yohananof' };

function dirs() {
  const root = mkdtempSync(join(tmpdir(), 'hatom-state-'));
  const paths = { storeState: join(root, 'state', 'stores'), raw: join(root, 'raw') };
  mkdirSync(paths.storeState, { recursive: true });
  mkdirSync(paths.raw, { recursive: true });
  return paths;
}
const fileOf = (paths: { storeState: string }, name = '7290803800003-40.json.gz') => join(paths.storeState, name);
const onDisk = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8')) as SavedStoreState;

test('PARSER_VERSION stays 2: the saved state keeps its format', () => {
  assert.equal(PARSER_VERSION, 2);
});

test('stateStore: a store\'s saved state is read from disk once per run', () => {
  const paths = dirs();
  writeFileSync(fileOf(paths), gzipSync(JSON.stringify(saved())));
  const state = stateStore(paths, () => {});
  const first = state.load(yo40);
  assert.equal(first?.items[0].priceAgorot, 500);
  // The file changes (or goes) behind the store's back: it is not read again.
  writeFileSync(fileOf(paths), gzipSync(JSON.stringify(saved({ items: [item('7290000000011', 999)] }))));
  assert.equal(state.load(yo40), first);
  rmSync(fileOf(paths));
  assert.equal(state.load(yo40), first);
  // A store with no saved state is remembered as such, too.
  assert.equal(state.load({ ...yo40, storeId: '41' }), null);
  writeFileSync(fileOf(paths, '7290803800003-41.json.gz'), gzipSync(JSON.stringify(saved({ storeId: '41' }))));
  assert.equal(state.load({ ...yo40, storeId: '41' }), null);
});

test('stateStore: save writes the file (stamped with the parser version) and is what load returns next', () => {
  const paths = dirs();
  const state = stateStore(paths, () => {});
  assert.equal(state.load(yo40), null);
  const next = saved({ parser: undefined, items: [item('7290000000028', 700)] });
  state.save(next);
  assert.equal(state.load(yo40), next);
  assert.deepEqual(onDisk(fileOf(paths)), { ...next, parser: 2 });
  // The file name is the store id with ':' → '-'.
  assert.deepEqual(readdirSync(paths.storeState), ['7290803800003-40.json.gz']);
});

test('stateStore: state saved by another parser version is re-parsed from the raw cache, once', () => {
  const paths = dirs();
  const FIX = join(import.meta.dirname, 'fixtures', 'shopping', 'yohananof');
  const price = 'PriceFull7290803800003-000-001-20261115-004031.gz';
  mkdirSync(join(paths.raw, 'yohananof'));
  copyFileSync(join(FIX, price), join(paths.raw, 'yohananof', price));
  writeFileSync(fileOf(paths, '7290803800003-1.json.gz'), gzipSync(JSON.stringify(saved({ parser: 1, storeId: '1', priceFile: price, promoFile: 'PromoFull-pruned.gz', items: [] }))));
  const lines: string[] = [];
  const state = stateStore(paths, (m) => lines.push(m));
  const st = state.load({ ...yo40, storeId: '1' })!;
  assert.ok(st.items.length > 1000);
  assert.equal(st.priceFile, price);
  assert.equal(st.promoFile, null); // its raw file was pruned: the next fetch re-parses
  assert.deepEqual(lines, ['  re-parsed saved state of 7290803800003:1 (parser v1 → v2)']);
  assert.equal(onDisk(fileOf(paths, '7290803800003-1.json.gz')).parser, 2);
  assert.equal(state.load({ ...yo40, storeId: '1' }), st);
  assert.equal(lines.length, 1);
});

test('stateStore: Wolt and manual state has no raw file to re-parse from, whatever its version', () => {
  const paths = dirs();
  writeFileSync(fileOf(paths, 'wolt-some-venue.json.gz'), gzipSync(JSON.stringify(saved({ parser: 1, chainId: 'wolt', storeId: 'some-venue', priceFile: 'wolt-some-venue-202611180900' }))));
  const st = stateStore(paths, () => assert.fail('no re-parse')).load({ chainId: 'wolt', storeId: 'some-venue', chainSlug: 'wolt' })!;
  assert.equal(st.priceFile, 'wolt-some-venue-202611180900');
  assert.equal(st.items.length, 1);
});

test('stateStore: prune removes the state of stores that left, and forgets them', () => {
  const paths = dirs();
  const state = stateStore(paths, () => {});
  state.save(saved());
  state.save(saved({ storeId: '54' }));
  state.save(saved({ chainId: 'wolt', storeId: 'a-venue-slug' })); // a slug with dashes: only the first '-' is the separator
  assert.equal(state.prune((id) => id === '7290803800003:40' || id === 'wolt:a-venue-slug'), 1);
  assert.deepEqual(readdirSync(paths.storeState).sort(), ['7290803800003-40.json.gz', 'wolt-a-venue-slug.json.gz']);
  assert.equal(state.load({ ...yo40, storeId: '54' }), null);
  assert.equal(existsSync(fileOf(paths)), true);
});

const rec = (chainId: string, id: string, over: Partial<StoreRecord> = {}): StoreRecord => ({
  chainId, storeId: id, subChainId: '', name: `${chainId} ${id}`, address: '', city: '0', kind: 'physical',
  chainSlug: chainId === 'wolt' || chainId === 'manual' ? chainId : `slug-${chainId}`, chainName: chainId, cityId: 'tel-aviv', ...over,
});

test('replaceFetched: a chain that came back with stores replaces its saved ones; the rest keep their place', () => {
  const registry = Object.fromEntries([rec('A', '1'), rec('B', '1'), rec('A', '2'), rec('wolt', 'v'), rec('C', '9')].map((s) => [`${s.chainId}:${s.storeId}`, s]));
  const fresh = [rec('A', '2', { name: 'renamed' }), rec('A', '3')];
  const rest = replaceFetched(registry, fresh);
  // B, Wolt and C were not fetched (or failed, or came back empty): they stay as saved, in the saved order.
  assert.deepEqual(Object.keys(rest), ['B:1', 'wolt:v', 'C:9']);
  assert.deepEqual(Object.keys(registry).length, 5); // the saved registry is not touched
  assert.deepEqual(Object.keys(replaceFetched(registry, [])), Object.keys(registry));
});

test('assignKeys: a store keeps its short key forever; new stores take the next numbers in order', () => {
  const keys = assignKeys([rec('A', '1'), rec('B', '7'), rec('A', '2'), rec('C', '3')], { 'A:1': 4, 'Z:9': 11, 'A:2': 2 });
  assert.deepEqual(keys, { 'A:1': 4, 'Z:9': 11, 'A:2': 2, 'B:7': 12, 'C:3': 13 });
  assert.deepEqual(assignKeys([rec('A', '1')], {}), { 'A:1': 1 });
});

test('manualStores: a record per shop with the shop\'s point, and an empty saved state for a new one', () => {
  const paths = dirs();
  const state = stateStore(paths, () => {});
  state.save(saved({ chainId: 'manual', storeId: 'aaaaaaaaaa', priceFile: null, items: [item('7290000000011', 1)] }));
  const chain = { slug: 'manual', chainId: 'manual', name: 'חנות שכונתית', source: { kind: 'manual' as const } };
  const out = manualStores(chain, [
    { id: 'aaaaaaaaaa', name: 'מכולת', address: 'ביאליק 26', city: 'ramat-gan', at: { lat: 32.08, lng: 34.81 } },
    { id: 'bbbbbbbbbb', name: 'ירקן', address: '', city: 'jerusalem', at: { lat: 31.78, lng: 35.19 } },
  ], state);
  assert.deepEqual(out, [
    { chainId: 'manual', storeId: 'aaaaaaaaaa', subChainId: '', name: 'מכולת', address: 'ביאליק 26', city: 'ramat-gan', kind: 'physical', chainSlug: 'manual', chainName: 'חנות שכונתית', cityId: 'ramat-gan', at: { lat: 32.08, lng: 34.81 } },
    { chainId: 'manual', storeId: 'bbbbbbbbbb', subChainId: '', name: 'ירקן', address: '', city: 'jerusalem', kind: 'physical', chainSlug: 'manual', chainName: 'חנות שכונתית', cityId: 'jerusalem', at: { lat: 31.78, lng: 35.19 } },
  ]);
  assert.equal(state.load(out[0])!.items.length, 1); // existing state is left alone
  assert.deepEqual(onDisk(fileOf(paths, 'manual-bbbbbbbbbb.json.gz')), { chainId: 'manual', storeId: 'bbbbbbbbbb', priceFile: null, promoFile: null, items: [], promos: [], parser: 2 });
});
