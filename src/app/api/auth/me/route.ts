import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

// Slim current-user JSON for static HTML pages (trip.html) that can't
// import the Auth.js helpers. Returns `{ email, isOwner, canWriteTrip }`
// for a signed-in user, or `null` when there's no session.
//
// `canWriteTrip` is duplicated here (instead of having trip-journey.js
// import `hasPermission`) because the static page is not bundled by Next.
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
      canWriteTrip: hasPermission(session, 'trip:write'),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
