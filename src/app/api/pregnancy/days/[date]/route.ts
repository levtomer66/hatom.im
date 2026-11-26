import { NextRequest, NextResponse } from 'next/server';
import { parseDayPatch } from '@/lib/pregnancy/daylog';
import { putDay } from '@/models/PregnancyDay';
import { bad, readJson, serverError } from '../../_shared';
import { dayGate } from '../_day';

type Params = { params: Promise<{ date: string }> };

// PUT { mood?, sym?, m?, today } — sets only the parts sent (null clears one).
// Answers { day } (null once nothing is left in it).
export async function PUT(request: NextRequest, { params }: Params) {
  const { date } = await params;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  const gate = await dayGate(request, date, b.today ?? null);
  if (gate instanceof NextResponse) return gate;
  const patch = parseDayPatch(Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'today')));
  if (!patch.ok) return bad(patch.error);
  try {
    return NextResponse.json({ day: await putDay(gate.p.id, date, patch.value) });
  } catch (error) {
    return serverError('saving a day', error);
  }
}
