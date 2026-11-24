import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../pregnancy/dates.ts';
import { bandAt, gainBand, gainVerdict } from '../pregnancy/gain.ts';
import { canInvite, extraKcal, parseEvent, parsePatch, parseReminder, parseSetup } from '../pregnancy/pregnancy.ts';

const TODAY = '2026-11-24';

test('gainBand picks the IOM 2009 band by pre-pregnancy BMI', () => {
  assert.deepEqual([gainBand(60, 165).lo, gainBand(60, 165).hi], [11.5, 16]);
  assert.deepEqual([gainBand(48, 165).lo, gainBand(48, 165).hi], [12.5, 18]);
  assert.deepEqual([gainBand(75, 165).lo, gainBand(75, 165).hi], [7, 11.5]);
  assert.deepEqual([gainBand(90, 165).lo, gainBand(90, 165).hi], [5, 9]);
});

test('bandAt: 0.5–2 kg by 13+6, the full band at 40+0', () => {
  const b = gainBand(60, 165);
  assert.deepEqual(bandAt(b, 0), { lo: 0, hi: 0 });
  assert.deepEqual(bandAt(b, 97), { lo: 0.5, hi: 2 });
  assert.deepEqual(bandAt(b, 280), { lo: 11.5, hi: 16 });
});

test('gainVerdict: in, over, under', () => {
  assert.equal(gainVerdict(60, 165, 61, 90).verdict, 'in');
  assert.equal(gainVerdict(60, 165, 70, 100).verdict, 'over');
  assert.equal(gainVerdict(60, 165, 60, 200).verdict, 'under');
  assert.equal(gainVerdict(60, 165, 64.24, 150).gain, 4.2);
});

test('extraKcal by trimester', () => {
  assert.equal(extraKcal(97), 0);
  assert.equal(extraKcal(98), 340);
  assert.equal(extraKcal(196), 450);
});

test('parseSetup: dating checked against today', () => {
  const ok = parseSetup({ method: 'lmp', date: '2026-09-01', preKg: 60, heightCm: 165 }, TODAY);
  assert.ok(ok.ok && ok.value.edd === '2027-06-08');
  assert.equal(parseSetup({ method: 'lmp', date: addDays(TODAY, 3) }, TODAY).ok, false);
  assert.equal(parseSetup({ method: 'edd', date: addDays(TODAY, 300) }, TODAY).ok, false);
  assert.equal(parseSetup({ method: 'lmp', date: '2025-01-01' }, TODAY).ok, false);
  assert.equal(parseSetup({ method: 'us', date: TODAY, w: 8, d: 2 }, TODAY).ok, true);
  assert.equal(parseSetup({ method: 'lmp', date: '2026-09-01', preKg: 10 }, TODAY).ok, false);
});

test('parsePatch: limit range, preKg may be cleared', () => {
  assert.equal(parsePatch({ cafLimit: 40 }, TODAY).ok, false);
  const p = parsePatch({ cafLimit: 250, preKg: null }, TODAY);
  assert.ok(p.ok && p.value.cafLimit === 250 && p.value.preKg === null);
  assert.equal(parsePatch({}, TODAY).ok, false);
});

test('parseEvent and parseReminder', () => {
  assert.equal(parseEvent({ title: 'סקירה', date: TODAY, time: '25:00' }).ok, false);
  assert.equal(parseEvent({ title: 'x'.repeat(81), date: TODAY }).ok, false);
  const e = parseEvent({ title: ' סקירה  מאוחרת ', date: TODAY, time: '09:30', kind: 'late-scan' });
  assert.ok(e.ok && e.value.title === 'סקירה מאוחרת' && e.value.remindBefore === true);
  assert.equal(parseEvent({ title: 'x', date: TODAY, kind: 'nope' }).ok, false);
  assert.equal(parseReminder({ text: 'ויטמינים', repeat: 'weekdays', days: [] }).ok, false);
  assert.equal(parseReminder({ text: 'ויטמינים', repeat: 'once' }).ok, false);
  const r = parseReminder({ text: 'ויטמינים', repeat: 'weekdays', days: [4, 0, 0] });
  assert.ok(r.ok && JSON.stringify(r.value.days) === '[0,4]');
});

test('canInvite', () => {
  const p = { members: ['a@x.com'], invites: [{ email: 'b@x.com', by: 'a@x.com', at: '' }] };
  assert.equal(canInvite(p, 'a@x.com').ok, false);
  assert.equal(canInvite(p, 'b@x.com').ok, false);
  assert.equal(canInvite(p, 'c@x.com').ok, true);
});
