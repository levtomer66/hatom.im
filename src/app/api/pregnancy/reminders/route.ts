import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { MAX_REMINDERS, parseReminder } from '@/lib/pregnancy/pregnancy';
import { addReminder, deleteReminder, updateReminder } from '@/models/Pregnancy';
import { bad, readJson, requirePregnancyCaller, serverError, pOut } from '../_shared';

// Reminders (in-page only): anyone in the pregnancy. Each answers { p }.

export async function POST(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const r = parseReminder(body);
  if (!r.ok) return bad(r.error);
  try {
    const p = await addReminder(gate.p.id, { ...r.value, id: randomUUID(), done: [] });
    return p ? NextResponse.json({ p: pOut(p, gate.caller.userEmail) }, { status: 201 }) : bad(`אפשר עד ${MAX_REMINDERS} תזכורות`);
  } catch (error) {
    return serverError('adding a reminder', error);
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const id = (body as Record<string, unknown> | null)?.id;
  const old = gate.p.reminders.find((x) => x.id === id);
  if (!old) return bad('תזכורת לא נמצאה', 404);
  const r = parseReminder(body);
  if (!r.ok) return bad(r.error);
  try {
    const p = await updateReminder(gate.p.id, { ...r.value, id: old.id, done: old.done });
    return p ? NextResponse.json({ p: pOut(p, gate.caller.userEmail) }) : bad('תזכורת לא נמצאה', 404);
  } catch (error) {
    return serverError('updating a reminder', error);
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return bad('תזכורת לא נמצאה', 404);
  try {
    const p = await deleteReminder(gate.p.id, id);
    return p ? NextResponse.json({ p: pOut(p, gate.caller.userEmail) }) : bad('תזכורת לא נמצאה', 404);
  } catch (error) {
    return serverError('deleting a reminder', error);
  }
}
