import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { isOwnerEmail } from '@/types/auth';

// `requireOwner` returns the session when the caller is an owner
// (Tom or Tomer), or a 401 NextResponse otherwise. Use the discriminator
// at the call site:
//
//   const gate = await requireOwner();
//   if (gate instanceof NextResponse) return gate;
//   const { session } = gate;            // typed
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
