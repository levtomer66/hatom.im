import { NextRequest, NextResponse } from 'next/server';
import { isDate } from '@/lib/pregnancy/dates';
import { setDone } from '@/models/Pregnancy';
import { bad, readJson, requirePregnancyCaller, serverError } from '../../_shared';

// POST { id, date, done, today } — ticks a reminder for a day (the last 14 days are kept).
export async function POST(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.id !== 'string' || !isDate(b.date) || !isDate(b.today) || typeof b.done !== 'boolean') return bad('בקשה לא תקינה');
  try {
    const p = await setDone(gate.p, b.id, b.date, b.done, b.today);
    return p ? NextResponse.json({ p }) : bad('תזכורת לא נמצאה', 404);
  } catch (error) {
    return serverError('ticking a reminder', error);
  }
}
