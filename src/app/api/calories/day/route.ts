import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { isDate, parseEntry, parseTotals, sumTotals, weekBars, weekDates, DEFAULT_GOAL, MAX_ENTRIES, type Entry } from '@/lib/calories/calories';
import type { DayResponse } from '@/lib/calories/api-types';
import { addEntry, addRecent, getDays, getUser } from '@/models/Calories';
import { bad, readJson, serverError } from '../_shared';

// GET ?date=YYYY-MM-DD — the caller's entries that day, goals, recent foods,
// and the 7 days' totals ending on it. "Today" is the device's date.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
  const date = request.nextUrl.searchParams.get('date');
  if (!isDate(date)) return bad('תאריך לא תקין');
  try {
    const dates = weekDates(date);
    const [byDate, user] = await Promise.all([getDays(caller.userEmail, dates), getUser(caller.userEmail)]);
    const totals = Object.fromEntries(Object.entries(byDate).map(([d, es]) => [d, sumTotals(es.map((e) => e.nu))]));
    const res: DayResponse = {
      date,
      entries: byDate[date] ?? [],
      settings: user.settings,
      week: weekBars(totals, date, user.settings?.goal ?? DEFAULT_GOAL),
      recent: user.recent,
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
