import { NextRequest, NextResponse } from 'next/server';
import { hasCurrentPermission } from '@/lib/api-caller';
import { canInvite } from '@/lib/pregnancy/pregnancy';
import { cancelInvite, invite, removeMember } from '@/models/Pregnancy';
import { bad, isOwner, readJson, requirePregnancyCaller, serverError, toViewer } from '../_shared';

// POST { email } — the owner invites someone (they accept on /pregnancy).
export async function POST(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!isOwner(gate.p, gate.caller.userEmail)) return bad('רק בעלת ההריון מזמינה', 403);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const raw = (body as Record<string, unknown> | null)?.email;
  const ok = canInvite(gate.p, typeof raw === 'string' ? raw : '');
  if (!ok.ok) return bad(ok.error);
  const email = (raw as string).trim().toLowerCase();
  try {
    const p = await invite(gate.p.id, { email, by: gate.caller.userEmail, at: new Date().toISOString() });
    if (!p) return bad('לא הצלחנו להזמין');
    const noAccess = !(await hasCurrentPermission(email, 'pregnancy'));
    return NextResponse.json({ p: toViewer(p, gate.caller.userEmail), noAccess }, { status: 201 });
  } catch (error) {
    return serverError('inviting', error);
  }
}

// DELETE ?email= — the owner cancels an invite or removes a member; a member removes themself.
export async function DELETE(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const email = request.nextUrl.searchParams.get('email')?.toLowerCase() ?? '';
  const me = gate.caller.userEmail;
  if (!isOwner(gate.p, me) && email !== me) return bad('רק בעלת ההריון', 403);
  if (email === gate.p.owner) return bad('בעלת ההריון לא יוצאת – אפשר לסמן ב־⚙ שהלידה הייתה');
  try {
    const p = gate.p.members.includes(email) ? await removeMember(gate.p.id, email) : await cancelInvite(gate.p.id, email);
    return NextResponse.json({ p: toViewer(p, gate.caller.userEmail) });
  } catch (error) {
    return serverError('removing', error);
  }
}
