import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { isOwnerEmail } from '@/types/auth';
import type { PermissionKey } from '@/types/permissions';
import { hasPermission } from '@/lib/permissions';
import { spaUserIdFromEmail, type SpaUserId } from '@/types/spa';

// Re-export so server-side callers keep a single import surface.
export { hasPermission };

// `requireSignedIn` returns the session when the caller has any valid
// Auth.js session (allowlisted or owner), or a 401 NextResponse otherwise.
// Use the discriminator at the call site:
//
//   const gate = await requireSignedIn();
//   if (gate instanceof NextResponse) return gate;
//   const { session } = gate;
//   const userId = session.user.email; // guaranteed non-null after the gate
export async function requireSignedIn(): Promise<
  { session: Session & { user: { email: string } } } | NextResponse
> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { session: session as Session & { user: { email: string } } };
}

// `requireOwner` is a stricter version that additionally requires the
// signed-in email to be in OWNER_EMAILS (Tom or Tomer). Used by every
// site-wide write endpoint (coffee-reviews, family-tree, trip uploads…).
//
// This replaces the legacy `requireTripAdmin` token-header gate.
export async function requireOwner(): Promise<
  { session: Session & { user: { email: string; isOwner: true } } } | NextResponse
> {
  const session = await auth();
  if (!session?.user?.email || !isOwnerEmail(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Caller knows the email is non-null and isOwner is true after this gate.
  return { session: session as Session & { user: { email: string; isOwner: true } } };
}

// API-route gate for per-page permission checks. Returns the session when
// the caller holds `key`, a 401 NextResponse when there's no session, or a
// 403 NextResponse when the session lacks the permission.
export async function requirePagePermission(key: PermissionKey): Promise<
  { session: Session & { user: { email: string } } } | NextResponse
> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPermission(session, key)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { session: session as Session & { user: { email: string } } };
}

// Gate for spa API endpoints. Independent of `OWNER_EMAILS` so the two
// SPA_USERS keep their write access even after one of them is demoted
// from site-wide ownership. Returns the resolved `spaUserId` alongside
// the session so callers can derive the giver/receiver without a second
// `spaUserIdFromEmail` call.
export async function requireSpaUser(): Promise<
  | {
      session: Session & { user: { email: string } };
      spaUserId: SpaUserId;
    }
  | NextResponse
> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const spaUserId = spaUserIdFromEmail(email);
  if (!spaUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return {
    session: session as Session & { user: { email: string } },
    spaUserId,
  };
}
