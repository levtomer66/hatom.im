import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { acceptPlan, canInvite, parseInviteEmail } from '@/lib/shopping/household';
import type { HouseholdResponse } from '@/lib/shopping/api-types';
import { isOwnerEmail } from '@/types/auth';
import { getUserDisplayName } from '@/types/workout';
import { getAuthorizedEmailEntry } from '@/models/AuthorizedEmail';
import {
  acceptInvite, addInvite, cancelInvite, declineInvite, householdFor, incomingInvites, leaveHousehold,
} from '@/models/ShoppingHome';

/** The caller's household as the page shows it. */
async function view(email: string): Promise<HouseholdResponse> {
  const [h, incoming] = await Promise.all([householdFor(email), incomingInvites(email)]);
  const loses = acceptPlan(h, email.toLowerCase()).loses;
  return {
    id: h.id,
    members: h.members.map((m) => ({ email: m, name: getUserDisplayName(m) })),
    invites: h.invites,
    incoming: incoming.map((i) => ({ ...i, byName: getUserDisplayName(i.by), loses })),
  };
}

/** Whether `email` may use /shopping: an owner, or allowlisted with the shopping page. */
async function hasShopping(email: string): Promise<boolean> {
  if (isOwnerEmail(email)) return true;
  return (await getAuthorizedEmailEntry(email))?.allowedPages.includes('shopping') ?? false;
}

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// GET — the caller's household (members, pending invites, invites to them).
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json(await view(caller.userEmail));
  } catch (error) {
    console.error('Error reading the household:', error);
    return bad('Failed to read the household', 500);
  }
}

// POST — one of { invite: email } | { cancel: email } | { accept: id } |
// { decline: id } | { leave: true }. Answers with the fresh household.
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let b: Record<string, unknown>;
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') throw new Error();
    b = body;
  } catch {
    return bad('Invalid JSON');
  }
  const me = caller.userEmail.toLowerCase();
  try {
    if (b.invite !== undefined) {
      const email = parseInviteEmail(b.invite);
      if (!email.ok) return bad(email.error);
      if (!(await hasShopping(email.value))) return bad('אין לכתובת הזו גישה לקניות');
      const h = await householdFor(me);
      const ok = canInvite(h, email.value);
      if (!ok.ok) return bad(ok.error, 409);
      if (!(await addInvite(h.id, { email: email.value, by: me, at: new Date().toISOString() }))) return bad('לא נשמר, נסו שוב', 409);
    } else if (b.cancel !== undefined) {
      const email = parseInviteEmail(b.cancel);
      if (!email.ok) return bad(email.error);
      await cancelInvite((await householdFor(me)).id, email.value);
    } else if (typeof b.accept === 'string') {
      if (!(await acceptInvite(me, b.accept))) return bad('ההזמנה כבר לא בתוקף', 409);
    } else if (typeof b.decline === 'string') {
      await declineInvite(me, b.decline);
    } else if (b.leave === true) {
      if (!(await leaveHousehold(me))) return bad('אין משק בית לעזוב: את/ה היחיד/ה בו', 409);
    } else {
      return bad('nothing to do');
    }
    return NextResponse.json(await view(me));
  } catch (error) {
    console.error('Error updating the household:', error);
    return bad('Failed to update the household', 500);
  }
}
