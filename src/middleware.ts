import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Run in Node.js (Fluid Compute) so the MongoDB session adapter loaded
// transitively by `@/auth` works at runtime. The default Edge runtime
// can't load the mongodb driver and 500s with MIDDLEWARE_INVOCATION_FAILED.
export const runtime = 'nodejs';

// Page-level gates. Auth.js middleware runs `auth()` against every matched
// request; we redirect to /login when the session is missing.
//
// Owner-only gates (admin allowlist, spa) are additionally enforced at the
// page / API level — the middleware just stops obvious anonymous traffic.
const GATED_PATHS: RegExp[] = [
  /^\/admin(?:\/|$)/,
  /^\/workout(?:\/|$)/,
  /^\/spa(?:\/|$)/,
  /^\/trip\.html$/,
];

export default auth((req) => {
  const path = req.nextUrl.pathname;
  if (!GATED_PATHS.some((re) => re.test(path))) return;
  if (req.auth) return; // signed in, let the page handle role-based gating

  const loginUrl = new URL('/login', req.nextUrl);
  loginUrl.searchParams.set('from', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // Skip static assets and Auth.js's own routes so the middleware doesn't
  // intercept the OAuth callback or token refresh.
  matcher: [
    '/admin/:path*',
    '/workout/:path*',
    '/spa/:path*',
    '/trip.html',
  ],
};
