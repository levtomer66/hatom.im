import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { isDate, kgOk, parseEntry, parseTotals, recommend, sumTotals, weekBars, weekDates, workoutBurn, DEFAULT_GOAL, MAX_ENTRIES, type Entry } from '@/lib/calories/calories';
import type { BurnedRow, DayResponse } from '@/lib/calories/api-types';
import { addEntry, addRecent, addWeighIn, getBurnedFixes, getDays, getUser, getWorkouts } from '@/models/Calories';
import { getUserSettings } from '@/models/WorkoutUserSettings';
import { bad, readJson, serverError } from '../_shared';

// GET ?date=YYYY-MM-DD[&today=YYYY-MM-DD] — the caller's entries that day, goals,
// recent foods, the 7 days' totals ending on it, that day's workouts (burned),
// the weight shared with the workout app, and the recommendation. "Today" is the
// device's date: on it, a weight changed in the workout app is logged as a weigh-in.
// While the goals follow the recommendation, they are recomputed here from the weight.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
  const date = request.nextUrl.searchParams.get('date');
  if (!isDate(date)) return bad('תאריך לא תקין');
  const today = request.nextUrl.searchParams.get('today');
  const email = caller.userEmail;
  try {
    const dates = weekDates(date);
    const [byDate, user, shared, workouts, fixes] = await Promise.all([
      getDays(email, dates), getUser(email), getUserSettings(email), getWorkouts(email, date), getBurnedFixes(email, date),
    ]);
    const kg = kgOk(shared.bodyweightKg) ? shared.bodyweightKg : null;
    let weighIns = user.weighIns;
    if (kg !== null && date === today && weighIns.at(-1)?.kg !== kg) weighIns = await addWeighIn(email, { d: date, kg });

    const year = Number(date.slice(0, 4));
    const rec = recommend(user.settings?.profile, user.settings?.aim, kg, year);
    const settings = user.settings && user.settings.followRec && rec ? { ...user.settings, ...rec } : user.settings;

    const burned: BurnedRow[] = workouts.map((w) => {
      const est = workoutBurn(w.sets, kg);
      const fix = fixes[w.id];
      return { id: w.id, name: w.name, kcal: fix ?? est.kcal, est: fix === undefined, estKcal: est.kcal, sets: est.sets, assumedKg: est.assumedKg };
    });
    const since = new Date(Date.UTC(year, Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) - 60)).toISOString().slice(0, 10);

    const totals = Object.fromEntries(Object.entries(byDate).map(([d, es]) => [d, sumTotals(es.map((e) => e.nu))]));
    const res: DayResponse = {
      date,
      entries: byDate[date] ?? [],
      settings,
      week: weekBars(totals, date, settings?.goal ?? DEFAULT_GOAL),
      recent: user.recent,
      burned,
      weight: { kg, log: weighIns.filter((w) => w.d >= since && w.d <= date) },
      rec,
    };
    return NextResponse.json(res);
  } catch (error) {
    return serverError('reading a day', error);
  }
}

// POST { date, entry, per100?, per? } — logs one entry (its totals frozen) and
// remembers the food in the caller's recent list (`per100` / `per` let it be logged again).
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isDate(b.date)) return bad('תאריך לא תקין');
  const parsed = parseEntry(b.entry);
  if (!parsed.ok) return bad(parsed.error);
  const entry: Entry = { ...parsed.value, base: { qty: parsed.value.qty, nu: parsed.value.nu }, id: randomUUID(), at: new Date().toISOString() };
  try {
    if (!(await addEntry(caller.userEmail, b.date, entry))) return bad(`אפשר עד ${MAX_ENTRIES} רישומים ביום`);
    const per100 = parseTotals(b.per100);
    const per = parseTotals(b.per) ?? undefined;
    await addRecent(caller.userEmail, { ref: entry.ref, name: entry.name, img: entry.img, unit: entry.unit, qty: entry.qty, per100, ...(per ? { per } : {}) });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return serverError('adding an entry', error);
  }
}
