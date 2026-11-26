import { NextRequest, NextResponse } from 'next/server';
import { addDays, isDate, israelToday } from '@/lib/pregnancy/dates';
import { dayAllowed } from '@/lib/pregnancy/daylog';
import type { Pregnancy } from '@/lib/pregnancy/pregnancy';
import { bad, requirePregnancyCaller, type Gate } from '../_shared';

// The day log's gate (docs/superpowers/specs/2026-11-26-pregnancy-day-log-design.md):
// anyone in the pregnancy; a write's day runs from day 0 to the device's today,
// which may be at most a day off Israel's (a phone abroad, around midnight).

export const OUT_OF_RANGE = 'אפשר לרשום רק מתחילת ההריון ועד היום';

export async function dayGate(request: NextRequest, date: string, today?: unknown): Promise<(Gate & { p: Pregnancy }) | NextResponse> {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  if (!isDate(date)) return bad('תאריך לא תקין');
  if (today !== undefined) {
    const il = israelToday(new Date());
    if (!isDate(today) || today < addDays(il, -1) || today > addDays(il, 1)) return bad('תאריך היום לא תקין');
    if (!dayAllowed(gate.p.edd, date, today)) return bad(OUT_OF_RANGE);
  }
  return gate as Gate & { p: Pregnancy };
}
