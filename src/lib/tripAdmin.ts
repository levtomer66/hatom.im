import { NextRequest, NextResponse } from 'next/server';

// Constant-time string comparison to avoid leaking the admin token via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Gate write endpoints behind a shared-secret header. Trip site is public,
// but write access is single-admin (the trip owner). Set TRIP_ADMIN_TOKEN
// in .env.local / Vercel environment variables — any long random string.
// Returns a 401 NextResponse to send back, or null when the request is
// authorised to continue.
export function requireTripAdmin(req: NextRequest): NextResponse | null {
  const expected = process.env.TRIP_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'TRIP_ADMIN_TOKEN is not configured on the server.' },
      { status: 500 }
    );
  }
  const provided = req.headers.get('x-admin-token') ?? '';
  if (!safeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
