// Server glue the /api/pregnancy routes share (docs/superpowers/specs/2026-11-24-pregnancy-design.md):
// the gate, the owner's caffeine and calories for a day, the weight-gain view,
// and logging a built-in drink into her calories diary.

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller, hasCurrentPermission, type FeatureCaller } from '@/lib/api-caller';
import { dayCaf, kgOk, recommend, sumTotals, DEFAULT_GOAL, MAX_ENTRIES, type Entry, type Meal } from '@/lib/calories/calories';
import { dayOfPregnancy } from '@/lib/pregnancy/dates';
import { drinkById, type Drink } from '@/lib/pregnancy/drinks';
import { bandLine, gainBand, gainVerdict } from '@/lib/pregnancy/gain';
import { extraKcal, type CafRow, type GainView, type Pregnancy, type PregnancyState } from '@/lib/pregnancy/pregnancy';
import { addEntry, addRecent, getDays, getUser } from '@/models/Calories';
import { invitesFor, pregnancyFor } from '@/models/Pregnancy';
import { getUserSettings } from '@/models/WorkoutUserSettings';

export { bad, readJson, serverError } from '../calories/_shared';

export type Gate = { caller: FeatureCaller; p: Pregnancy | null };

export async function requirePregnancyCaller(request: NextRequest): Promise<Gate | NextResponse> {
  const caller = await requireFeatureCaller(request, 'pregnancy');
  if (caller instanceof NextResponse) return caller;
  return { caller, p: await pregnancyFor(caller.userEmail) };
}

export const isOwner = (p: Pregnancy | null, email: string): p is Pregnancy => !!p && p.owner === email;

/** The emoji a caffeine row shows: the drink's own, else ☕. */
const emojiOf = (e: Entry) => (e.ref.kind === 'drink' && e.ref.key ? drinkById(e.ref.key)?.emoji : null) ?? '☕';

export const cafRows = (entries: Entry[]): CafRow[] =>
  entries.filter((e) => (e.caf ?? 0) > 0).map((e) => ({
    id: e.id, name: e.name, emoji: emojiOf(e), mg: e.caf as number, at: e.at, meal: e.meal, qty: e.qty, unit: e.unit.name,
  }));

/** The owner's goal for the day as /calories computes it, with the trimester's extra while following. */
export async function goalFor(email: string, day: number, year: number): Promise<number> {
  const [user, shared] = await Promise.all([getUser(email), getUserSettings(email)]);
  const kg = kgOk(shared.bodyweightKg) ? shared.bodyweightKg : null;
  const s = user.settings;
  if (!s) return DEFAULT_GOAL;
  const rec = s.followRec ? recommend(s.profile, s.aim, kg, year, extraKcal(day)) : null;
  return rec?.goal ?? s.goal;
}

/** Her gain since the pre-pregnancy weight; null without that weight, a height or a current weight. */
export async function gainFor(p: Pregnancy, today: string): Promise<GainView | null> {
  if (p.preKg === null) return null;
  const [user, shared] = await Promise.all([getUser(p.owner), getUserSettings(p.owner)]);
  const heightCm = user.settings?.profile?.heightCm ?? p.heightCm;
  const kg = kgOk(shared.bodyweightKg) ? shared.bodyweightKg : user.weighIns.at(-1)?.kg ?? null;
  if (!heightCm || kg === null) return null;
  const day = dayOfPregnancy(p.edd, today);
  const v = gainVerdict(p.preKg, heightCm, kg, day);
  const log = user.weighIns
    .map((w) => ({ day: dayOfPregnancy(p.edd, w.d), kg: w.kg }))
    .filter((w) => w.day >= 0 && w.day <= day);
  return { ...v, preKg: p.preKg, log, band: bandLine(gainBand(p.preKg, heightCm)) };
}

/** Everything /pregnancy shows for `date` (the caller's view). */
export async function stateFor(email: string, p: Pregnancy | null, date: string, today: string): Promise<PregnancyState> {
  const canCoffee = await hasCurrentPermission(email, 'coffee-order');
  if (!p) return { role: 'none', p: null, invites: await invitesFor(email), caf: null, kcal: null, gain: null, canCoffee, heightCm: null };
  const owner = p.owner === email;
  const entries = (await getDays(p.owner, [date]))[date] ?? [];
  const caf = { mg: dayCaf(entries), limit: p.cafLimit, rows: cafRows(entries) };
  if (!owner) return { role: 'member', p, invites: [], caf, kcal: null, gain: null, canCoffee, heightCm: null };
  const day = dayOfPregnancy(p.edd, date);
  const [goal, gain, user] = await Promise.all([goalFor(email, day, Number(date.slice(0, 4))), gainFor(p, today), getUser(email)]);
  return {
    role: 'owner', p, invites: [], caf,
    kcal: { eaten: sumTotals(entries.map((e) => e.nu)).kcal, goal },
    gain, canCoffee, heightCm: user.settings?.profile?.heightCm ?? p.heightCm,
  };
}

/** A built-in drink as a diary entry: `qty` units, caffeine and totals frozen. */
export function drinkEntry(d: Drink, qty: number, meal: Meal, extra: Partial<Entry> = {}): Entry {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const nu = { kcal: Math.round(d.nu.kcal * qty), p: r1(d.nu.p * qty), c: r1(d.nu.c * qty), f: r1(d.nu.f * qty) };
  const caf = Math.round(d.mg * qty);
  return {
    id: randomUUID(), meal, name: d.name, img: null, ref: { kind: 'drink', key: d.id }, unit: { name: d.unit, g: d.g }, qty, nu, caf,
    base: { qty, nu, caf }, at: new Date().toISOString(), ...extra,
  };
}

/** Logs it and remembers it among her recent foods. false when the day is full. */
export async function logEntry(email: string, date: string, e: Entry, per?: Entry['nu']): Promise<boolean> {
  if (!(await addEntry(email, date, e))) return false;
  await addRecent(email, { ref: e.ref, name: e.name, img: e.img, unit: e.unit, qty: e.qty, per100: null, ...(per ? { per } : {}) });
  return true;
}

export const FULL_DAY = `אפשר עד ${MAX_ENTRIES} רישומים ביום`;
