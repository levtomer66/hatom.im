import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { MAX_NOTES, parseNote } from '@/lib/pregnancy/daylog';
import { addNote, deleteNote, updateNote } from '@/models/PregnancyDay';
import { bad, readJson, serverError } from '../../../_shared';
import { dayGate } from '../../_day';

type Params = { params: Promise<{ date: string }> };

// A day's notes: POST { text, star?, today }, PATCH { id, text, star }, DELETE ?id=.
// Anyone in the pregnancy, signed with the writer's email. Each answers { day }.
export async function POST(request: NextRequest, { params }: Params) {
  const { date } = await params;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  const gate = await dayGate(request, date, b.today ?? null);
  if (gate instanceof NextResponse) return gate;
  const n = parseNote(b);
  if (!n.ok) return bad(n.error);
  try {
    const day = await addNote(gate.p.id, date, {
      id: randomUUID(), text: n.value.text, ...(n.value.star ? { star: true as const } : {}), by: gate.caller.userEmail.toLowerCase(), at: new Date().toISOString(),
    });
    return day === 'full' ? bad(`אפשר עד ${MAX_NOTES} הערות ביום`) : NextResponse.json({ day }, { status: 201 });
  } catch (error) {
    return serverError('adding a note', error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { date } = await params;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  const gate = await dayGate(request, date);
  if (gate instanceof NextResponse) return gate;
  if (typeof b.id !== 'string') return bad('הערה לא נמצאה', 404);
  const n = parseNote(b);
  if (!n.ok) return bad(n.error);
  try {
    const day = await updateNote(gate.p.id, date, b.id, n.value);
    return day === undefined ? bad('הערה לא נמצאה', 404) : NextResponse.json({ day });
  } catch (error) {
    return serverError('editing a note', error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { date } = await params;
  const gate = await dayGate(request, date);
  if (gate instanceof NextResponse) return gate;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return bad('הערה לא נמצאה', 404);
  try {
    return NextResponse.json({ day: await deleteNote(gate.p.id, date, id) });
  } catch (error) {
    return serverError('deleting a note', error);
  }
}
