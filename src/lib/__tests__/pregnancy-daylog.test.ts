import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayAllowed, isEmptyDay, measureText, moodColor, parseDayPatch, parseNote, prevValues, trendText, weekSummary } from '../pregnancy/daylog.ts';

const EDD = '2027-06-08'; // day 0 = 2026-09-01

test('parseDayPatch keeps absent parts absent and null as a clear', () => {
  assert.deepEqual(parseDayPatch({ mood: 4 }), { ok: true, value: { mood: 4 } });
  assert.deepEqual(parseDayPatch({ mood: null }), { ok: true, value: { mood: null } });
  assert.equal(parseDayPatch({}).ok, false);
  assert.equal(parseDayPatch({ mood: 6 }).ok, false);
  assert.equal(parseDayPatch({ sym: { nausea: 4 } }).ok, false);
  assert.equal(parseDayPatch({ sym: { hiccups: 1 } }).ok, false);
  assert.deepEqual(parseDayPatch({ sym: { nausea: 2, tired: 0 } }), { ok: true, value: { sym: { nausea: 2 } } });
});

test('parseDayPatch: bp only as an in-range pair', () => {
  assert.equal(parseDayPatch({ m: { bp: [120] } }).ok, false);
  assert.equal(parseDayPatch({ m: { bp: [300, 80] } }).ok, false);
  assert.deepEqual(parseDayPatch({ m: { bp: [120, 80], fhr: 150 } }), { ok: true, value: { m: { bp: [120, 80], fhr: 150 } } });
  assert.equal(parseDayPatch({ m: { sugar: 10 } }).ok, false);
  assert.deepEqual(parseDayPatch({ m: { belly: 90.4 } }), { ok: true, value: { m: { belly: 90 } } });
});

test('parseNote trims, caps at 500, star optional', () => {
  assert.deepEqual(parseNote({ text: '  בעיטה ראשונה ', star: true }), { ok: true, value: { text: 'בעיטה ראשונה', star: true } });
  assert.deepEqual(parseNote({ text: 'סתם' }), { ok: true, value: { text: 'סתם', star: false } });
  assert.equal(parseNote({ text: '' }).ok, false);
  assert.equal(parseNote({ text: 'א'.repeat(501) }).ok, false);
});

test('dayAllowed: day 0 through today only', () => {
  assert.equal(dayAllowed(EDD, '2026-09-01', '2026-11-26'), true);
  assert.equal(dayAllowed(EDD, '2026-11-26', '2026-11-26'), true);
  assert.equal(dayAllowed(EDD, '2026-08-31', '2026-11-26'), false);
  assert.equal(dayAllowed(EDD, '2026-11-27', '2026-11-26'), false);
  assert.equal(dayAllowed(EDD, 'nope', '2026-11-26'), false);
});

test('isEmptyDay', () => {
  assert.equal(isEmptyDay({}), true);
  assert.equal(isEmptyDay({ sym: {}, m: {}, notes: [] }), true);
  assert.equal(isEmptyDay({ mood: 3 }), false);
  assert.equal(isEmptyDay({ notes: [{ id: 'n', text: 'x', by: 'a', at: 't' }] }), false);
});

test('weekSummary averages mood per week, flags stars, drops weeks outside 1–40', () => {
  const s = weekSummary([
    { date: '2026-11-24', mood: 2 }, { date: '2026-11-25', mood: 4, star: true },
    { date: '2026-11-26' },
    { date: '2026-09-02', mood: 5 },
  ], EDD);
  assert.deepEqual(s, { 12: { mood: 3, star: true } });
  assert.deepEqual(weekSummary([{ date: '2026-11-26', star: true }], EDD), { 12: { mood: null, star: true } });
});

test('prevValues: the last earlier value of each measure', () => {
  const p = prevValues([
    { date: '2026-11-10', m: { bp: [118, 76], sugar: 90 } },
    { date: '2026-11-20', m: { bp: [120, 80] } },
    { date: '2026-11-26', m: { bp: [125, 82] } },
  ], '2026-11-26');
  assert.deepEqual(p, { bp: { value: [120, 80], date: '2026-11-20' }, sugar: { value: 90, date: '2026-11-10' } });
});

test('measureText and trendText', () => {
  assert.equal(measureText('bp', [120, 80]), '120/80');
  assert.equal(measureText('fhr', 150), '150 פעימות לדקה');
  assert.equal(trendText('bp', [125, 80], [120, 80]), '↑5');
  assert.equal(trendText('belly', 90, 92), '↓2');
  assert.equal(trendText('sugar', 90, 90), 'ללא שינוי');
});

test('moodColor runs red to green', () => {
  assert.equal(moodColor(1), 'hsl(0 70% 50%)');
  assert.equal(moodColor(5), 'hsl(120 70% 50%)');
  assert.equal(moodColor(3), 'hsl(60 70% 50%)');
});
