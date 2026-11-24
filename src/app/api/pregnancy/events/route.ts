import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { MAX_EVENTS, parseEvent } from '@/lib/pregnancy/pregnancy';
import { addEvent, deleteEvent, updateEvent } from '@/models/Pregnancy';
import { bad, readJson, requirePregnancyCaller, serverError } from '../_shared';

// Events: anyone in the pregnancy adds, edits and deletes them. Each answers { p }.

export async function POST(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const e = parseEvent(body);
  if (!e.ok) return bad(e.error);
  try {
    const p = await addEvent(gate.p.id, { ...e.value, id: randomUUID() });
    return p ? NextResponse.json({ p }, { status: 201 }) : bad(`אפשר עד ${MAX_EVENTS} אירועים`);
  } catch (error) {
    return serverError('adding an event', error);
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const id = (body as Record<string, unknown> | null)?.id;
  if (typeof id !== 'string') return bad('אירוע לא נמצא', 404);
  const e = parseEvent(body);
  if (!e.ok) return bad(e.error);
  try {
    const p = await updateEvent(gate.p.id, { ...e.value, id });
    return p ? NextResponse.json({ p }) : bad('אירוע לא נמצא', 404);
  } catch (error) {
    return serverError('updating an event', error);
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return bad('אירוע לא נמצא', 404);
  try {
    const p = await deleteEvent(gate.p.id, id);
    return p ? NextResponse.json({ p }) : bad('אירוע לא נמצא', 404);
  } catch (error) {
    return serverError('deleting an event', error);
  }
}
