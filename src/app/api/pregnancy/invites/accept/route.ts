import { NextRequest, NextResponse } from 'next/server';
import { acceptInvite, declineInvite } from '@/models/Pregnancy';
import { bad, readJson, requirePregnancyCaller, serverError } from '../../_shared';

// POST { id, accept } — the invitee joins (or declines). One active pregnancy per person.
export async function POST(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.id !== 'string') return bad('הזמנה לא נמצאה', 404);
  try {
    if (b.accept === false) {
      await declineInvite(b.id, gate.caller.userEmail);
      return NextResponse.json({ ok: true });
    }
    const r = await acceptInvite(b.id, gate.caller.userEmail);
    if (r === 'busy') return bad('את/ה כבר עוקב/ת אחרי הריון אחר', 409);
    if (r === 'gone') return bad('ההזמנה כבר לא בתוקף', 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('accepting an invite', error);
  }
}
