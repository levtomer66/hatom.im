import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Slim current-user JSON for static HTML pages (trip.html) that can't
// import the Auth.js helpers. Returns `{ email, isOwner }` for a
// signed-in user, or `null` when there's no session.
//
// No-cache so the static page always sees the latest sign-in state.
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(null, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return NextResponse.json(
    {
      email: session.user.email,
      isOwner: session.user.isOwner === true,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
