import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bragCandidates,
  chooseBrag,
  renderBrag,
  bragLine,
  thingCandidates,
  seededRandom,
  type BragFacts,
  type BragPick,
} from '../workout-brag.ts';

const facts = (over: Partial<BragFacts> = {}): BragFacts => ({
  totalVolumeKg: 9500,
  setsLogged: 18,
  reps: 160,
  minutes: 62,
  top: { id: 'leg-press', name: 'Leg Press', volumeKg: 4000, reps: 40 },
  prevVolumeKg: 8000,
  localHour: 6,
  ...over,
});

test('every total from 1 kg to 2,000 t gets a 1–3 object (no ladder gaps)', () => {
  for (let kg = 1; kg < 2_000_000; kg *= 1.07) {
    const c = thingCandidates(kg);
    assert.ok(c.length > 0, `no object for ${kg}`);
    if (kg > 4 && kg < 3_000_000) assert.ok(c.some((x) => x.n <= 2), `only 3s at ${kg}`);
  }
});

test('a typical 9.5 t workout has many different objects and families to choose from', () => {
  const all = bragCandidates(facts());
  const things = new Set(all.filter((p) => p.f === 'thing').map((p) => p.thing));
  const families = new Set(all.map((p) => p.f));
  assert.ok(things.size >= 5, `only ${things.size} objects`);
  for (const f of ['thing', 'top', 'vs-last', 'reps', 'time', 'hour']) assert.ok(families.has(f as BragPick['f']), f);
});

test('every candidate renders in both languages with no leftover placeholders', () => {
  for (const f of [facts(), facts({ prevVolumeKg: 12000, localHour: 22 }), facts({ totalVolumeKg: 0, localHour: 13 })]) {
    for (const p of bragCandidates(f)) {
      for (const lang of ['en', 'he'] as const) {
        const line = renderBrag(p, lang);
        assert.ok(line && line.length > 10, JSON.stringify(p));
        assert.doesNotMatch(line!, /\{\w+\}/, `${lang} ${JSON.stringify(p)}: ${line}`);
        // English names carry their own a/an: nothing may stand in front of it.
        if (lang === 'en') assert.doesNotMatch(line!, /\b(the|their|your|extra|an?) an? \w/i, line!);
      }
    }
  }
});

test('15 workouts in a row with the same volume never repeat a sentence', () => {
  const recent: BragPick[] = [];
  const rand = seededRandom('streak');
  const seen = new Set<string>();
  for (let i = 0; i < 15; i++) {
    const p = chooseBrag(facts(), recent, rand);
    const key = `${p.f}:${p.t}:${p.thing ?? ''}`;
    assert.ok(!seen.has(key), `repeat at ${i}: ${key}`);
    seen.add(key);
    recent.unshift(p);
  }
});

test('the family changes from one workout to the next when it can', () => {
  const rand = seededRandom('families');
  let last: BragPick | null = null;
  const recent: BragPick[] = [];
  for (let i = 0; i < 10; i++) {
    const p = chooseBrag(facts(), recent, rand);
    if (last) assert.notEqual(p.f, last.f);
    last = p;
    recent.unshift(p);
  }
});

test('bodyweight-only sessions get a bodyweight line', () => {
  const p = chooseBrag(facts({ totalVolumeKg: 0, top: null, prevVolumeKg: null, localHour: 10, reps: 0, minutes: null }), []);
  assert.equal(p.f, 'bodyweight');
});

test('{exercise} uses the localizer, else the stored English name', () => {
  const pick: BragPick = { v: 1, f: 'top', t: 0, thing: 'retriever', n: 1, x: { exercise: 'custom-x', exName: 'My Row', reps: 12 } };
  assert.match(renderBrag(pick, 'en')!, /^My Row:/);
  assert.match(renderBrag(pick, 'he', () => 'חתירה')!, /^חתירה:/);
});

test('older workouts without a stored pick get a stable seeded line', () => {
  const a = bragLine(undefined, 9500, 'w1', 'en');
  assert.equal(a, bragLine(null, 9500, 'w1', 'en'));
  assert.ok(a.length > 10);
});

test('garbage in the stored field falls back instead of throwing', () => {
  assert.ok(bragLine({ v: 9, f: 'nope' }, 300, 'w2', 'he').length > 10);
});
