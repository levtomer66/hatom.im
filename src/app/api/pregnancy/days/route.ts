import { NextRequest, NextResponse } from 'next/server';
import { daysBetween, isDate } from '@/lib/pregnancy/dates';
import { weekSummary } from '@/lib/pregnancy/daylog';
import { getDayRange, getSummaryRows, prevMeasures } from '@/models/PregnancyDay';
import { bad, requirePregnancyCaller, serverError } from '../_shared';

// GET ?summary=1 → { weeks } (the cubes), ?from&to (≤ 21 days) → { days } (the open
// week), ?prev=<date> → { prev } (each measurement's last earlier value). Everyone
// in the pregnancy sees the whole log, on purpose (no forViewer).
export async function GET(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const q = request.nextUrl.searchParams;
  const pid = gate.p.id;
  try {
    if (q.get('summary')) return NextResponse.json({ weeks: weekSummary(await getSummaryRows(pid), gate.p.edd) });
    const prev = q.get('prev');
    if (prev !== null) return isDate(prev) ? NextResponse.json({ prev: await prevMeasures(pid, prev) }) : bad('תאריך לא תקין');
    const from = q.get('from');
    const to = q.get('to');
    if (!isDate(from) || !isDate(to) || to < from) return bad('טווח לא תקין');
    if (daysBetween(from, to) > 20) return bad('טווח של עד 3 שבועות');
    return NextResponse.json({ days: await getDayRange(pid, from, to) });
  } catch (error) {
    return serverError('reading the day log', error);
  }
}
