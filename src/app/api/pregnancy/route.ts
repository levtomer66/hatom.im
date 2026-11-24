import { NextRequest, NextResponse } from 'next/server';
import { isDate } from '@/lib/pregnancy/dates';
import { parsePatch, parseSetup } from '@/lib/pregnancy/pregnancy';
import { createPregnancy, endPregnancy, patchPregnancy } from '@/models/Pregnancy';
import { bad, isOwner, readJson, requirePregnancyCaller, serverError, stateFor, toViewer } from './_shared';

// GET ?date=&today= — the page's state: the pregnancy, the caller's role, invites
// waiting for them, the owner's caffeine on `date` (members see only that),
// and for the owner her calories and weight gain.
export async function GET(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  const date = request.nextUrl.searchParams.get('date');
  const today = request.nextUrl.searchParams.get('today') ?? date;
  if (!isDate(date) || !isDate(today)) return bad('תאריך לא תקין');
  try {
    return NextResponse.json(await stateFor(gate.caller.userEmail, gate.p, date, today));
  } catch (error) {
    return serverError('reading the pregnancy', error);
  }
}

// POST { method, date, w?, d?, preKg?, heightCm?, today } — sets up the caller's own pregnancy.
export async function POST(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (gate.p) return bad('כבר יש הריון פעיל', 409);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isDate(b.today)) return bad('תאריך לא תקין');
  const s = parseSetup(b, b.today);
  if (!s.ok) return bad(s.error);
  try {
    const p = await createPregnancy(gate.caller.userEmail, s.value);
    if (!p) return bad('כבר יש הריון פעיל', 409);
    return NextResponse.json({ p: toViewer(p, gate.caller.userEmail) }, { status: 201 });
  } catch (error) {
    return serverError('creating the pregnancy', error);
  }
}

// PATCH { method/date/w/d?, preKg?, heightCm?, cafLimit?, today } — anyone in it may
// re-date it; her weight, height and caffeine limit are the owner's.
export async function PATCH(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isDate(b.today)) return bad('תאריך לא תקין');
  const patch = parsePatch(b, b.today);
  if (!patch.ok) return bad(patch.error);
  const ownerOnly = patch.value.preKg !== undefined || patch.value.cafLimit !== undefined || patch.value.heightCm !== undefined;
  if (ownerOnly && !isOwner(gate.p, gate.caller.userEmail)) return bad('רק בעלת ההריון יכולה לשנות את זה', 403);
  try {
    return NextResponse.json({ p: toViewer(await patchPregnancy(gate.p.id, patch.value), gate.caller.userEmail) });
  } catch (error) {
    return serverError('updating the pregnancy', error);
  }
}

// DELETE — "הלידה הייתה": the owner ends it; the doc is kept, hidden.
export async function DELETE(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!isOwner(gate.p, gate.caller.userEmail)) return bad('רק בעלת ההריון', 403);
  try {
    await endPregnancy(gate.p.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('ending the pregnancy', error);
  }
}
