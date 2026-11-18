import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOMINATIM_GAP_MS, NominatimError, nominatim } from '../shopping/ingest/geo.ts';

/** A clock that only moves when the client sleeps, and a fetch that answers from a script. */
function harness(script: (number | unknown[])[]) {
  let t = 1_000_000;
  const calls: { at: number; url: string; headers: Record<string, string> }[] = [];
  const sleeps: number[] = [];
  const search = nominatim('hatom-test/0.1', {
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    fetch: async (url, init) => {
      calls.push({ at: t, url: String(url), headers: init?.headers as Record<string, string> });
      const next = script.shift();
      if (next === undefined) throw new Error('unexpected request');
      return typeof next === 'number' ? new Response('slow down', { status: next }) : Response.json(next);
    },
  });
  return { search, calls, sleeps, advance: (ms: number) => (t += ms) };
}

test('nominatim: one request at a time, at least 1.5 s apart, with the caller\'s parameters and User-Agent', async () => {
  const h = harness([[{ lat: '32.08', lon: '34.78' }], [], []]);
  assert.equal(NOMINATIM_GAP_MS, 1500);
  assert.deepEqual(await h.search({ q: 'ביאליק 26 רמת גן', format: 'jsonv2', limit: '1', countrycodes: 'il' }), [{ lat: '32.08', lon: '34.78' }]);
  assert.deepEqual(await h.search({ q: 'b' }), []);
  h.advance(5000); // the caller was busy for longer than the gap: no wait
  await h.search({ q: 'c' });
  assert.deepEqual(h.sleeps, [1500]);
  assert.deepEqual(h.calls.map((c) => c.at - h.calls[0].at), [0, 1500, 6500]);
  assert.equal(h.calls[0].url, `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: 'ביאליק 26 רמת גן', format: 'jsonv2', limit: '1', countrycodes: 'il' })}`);
  assert.deepEqual(h.calls[0].headers, { 'User-Agent': 'hatom-test/0.1', 'Accept-Language': 'he' });
});

test('nominatim: 429 / 503 back off 10 s, 20 s, 40 s, then give up', async () => {
  const ok = harness([429, 503, [{ lat: '1', lon: '2' }]]);
  assert.deepEqual(await ok.search({ q: 'a' }), [{ lat: '1', lon: '2' }]);
  assert.deepEqual(ok.sleeps, [10_000, 20_000]);

  const never = harness([429, 429, 429, 429]);
  await assert.rejects(never.search({ q: 'a' }), (e) => e instanceof NominatimError && e.status === 429 && e.message === 'Nominatim 429');
  assert.deepEqual(never.sleeps, [10_000, 20_000, 40_000]);
  assert.equal(never.calls.length, 4);
});

test('nominatim: any other refusal is raised at once', async () => {
  const h = harness([403]);
  await assert.rejects(h.search({ q: 'a' }), (e) => e instanceof NominatimError && e.status === 403);
  assert.deepEqual(h.sleeps, []);
});
