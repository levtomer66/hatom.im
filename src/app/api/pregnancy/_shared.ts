// Server glue the /api/pregnancy routes share (docs/superpowers/specs/2026-11-24-pregnancy-design.md):
// the gate, the owner's caffeine and calories for a day, the weight-gain view,
// and logging a built-in drink into her calories diary.

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller, hasCurrentPermission, type FeatureCaller } from '@/lib/api-caller';
import { dayCaf, kgOk, recommend, sumTotals, DEFAULT_GOAL, MAX_ENTRIES, type Entry } from '@/lib/calories/calories';
import { dayOfPregnancy } from '@/lib/pregnancy/dates';
import { bandLine, gainBand, gainVerdict } from '@/lib/pregnancy/gain';
import { cafRow, extraKcal, forViewer, memberCafRow, type CafRow, type GainView, type Pregnancy, type PregnancyState } from '@/lib/pregnancy/pregnancy';
import { getDays, getUser } from '@/models/Calories';
import { invitesFor, pregnancyFor } from '@/models/Pregnancy';
import { getUserSettings } from '@/models/WorkoutUserSettings';

export { bad, readJson, serverError } from '../calories/_shared';
export { drinkEntry, logEntry } from '@/lib/pregnancy-diary';

export type Gate = { caller: FeatureCaller; p: Pregnancy | null };

export async function requirePregnancyCaller(request: NextRequest): Promise<Gate | NextResponse> {
  const caller = await requireFeatureCaller(request, 'pregnancy');
  if (caller instanceof NextResponse) return caller;
  return { caller, p: await pregnancyFor(caller.userEmail) };
}

export const isOwner = (p: Pregnancy | null, email: string): p is Pregnancy => !!p && p.owner === email;

/** A doc on its way to `email`: members never get her weight or height. */
export const toViewer = (p: Pregnancy | null, email: string): Pregnancy | null => (p ? forViewer(p, email) : null);

export const cafRows = (entries: Entry[]): CafRow[] => entries.filter((e) => (e.caf ?? 0) > 0).map(cafRow);

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
  if (!p) {
    const user = await getUser(email);
    return { role: 'none', p: null, invites: await invitesFor(email), caf: null, kcal: null, gain: null, canCoffee, heightCm: user.settings?.profile?.heightCm ?? null, lastKg: user.weighIns.at(-1)?.kg ?? null };
  }
  const owner = p.owner === email;
  const entries = (await getDays(p.owner, [date]))[date] ?? [];
  const caf = { mg: dayCaf(entries), limit: p.cafLimit, rows: cafRows(entries) };
  if (!owner) {
    // Members: name, emoji, mg and time only — not her meals, amounts or entry ids.
    const rows = caf.rows.map(memberCafRow);
    return { role: 'member', p: toViewer(p, email), invites: [], caf: { ...caf, rows }, kcal: null, gain: null, canCoffee, heightCm: null, lastKg: null };
  }
  const day = dayOfPregnancy(p.edd, date);
  const [goal, gain, user] = await Promise.all([goalFor(email, day, Number(date.slice(0, 4))), gainFor(p, today), getUser(email)]);
  return {
    role: 'owner', p, invites: [], caf,
    kcal: { eaten: sumTotals(entries.map((e) => e.nu)).kcal, goal },
    gain, canCoffee, heightCm: user.settings?.profile?.heightCm ?? p.heightCm, lastKg: null,
  };
}

export const FULL_DAY = `אפשר עד ${MAX_ENTRIES} רישומים ביום`;
