import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { isOwnerEmail } from '@/types/auth';

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
