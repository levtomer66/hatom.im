import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import type { PermissionKey } from '@/types/permissions';

// Run in Node.js (Fluid Compute) so the MongoDB session adapter loaded
// transitively by `@/auth` works at runtime. The default Edge runtime
// can't load the mongodb driver and 500s with MIDDLEWARE_INVOCATION_FAILED.
export const runtime = 'nodejs';

// Map each gated route prefix to the permission key the user must hold.
// Anonymous traffic → redirect to /login?from=…; signed-in but missing
// the permission → redirect to / (no `?from=` since they can't reach it
// anyway). Owners pass every gate because the session callback gives them
// every PermissionKey.
//
// /admin/* is owner-only and uses a sentinel `'__owner'` key handled
// inline below so it never has to be a granular PermissionKey.
interface Gate {
  pattern: RegExp;
  permission: PermissionKey | '__owner';
}

const GATES: readonly Gate[] = [
  { pattern: /^\/admin(?:\/|$)/,             permission: '__owner'     },
  { pattern: /^\/workout(?:\/|$)/,           permission: 'workout'     },
  { pattern: /^\/spa(?:\/|$)/,               permission: 'spa'         },
  { pattern: /^\/sex(?:\/|$)/,               permission: 'valentine'   },
  { pattern: /^\/trip\.html$/,               permission: 'trip'        },
  { pattern: /^\/vegas-wedding-guide\.html$/, permission: 'vegas-guide' },
  { pattern: /^\/family-tree(?:\/|$)/,       permission: 'family-tree' },
  { pattern: /^\/mekafkefim(?:\/|$)/,        permission: 'mekafkefim'  },
  { pattern: /^\/instomit(?:\/|$)/,          permission: 'instomit'    },
];

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const gate = GATES.find((g) => g.pattern.test(path));
  if (!gate) return;

  const session = req.auth;
  if (!session?.user) {
    const loginUrl = new URL('/login', req.nextUrl);
    loginUrl.searchParams.set('from', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Owners always pass (the session callback fills allowedPages for them).
  if (session.user.isOwner) return;

  // /admin/* is owner-only; non-owners get bounced home.
  if (gate.permission === '__owner') {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  const allowed = session.user.allowedPages?.includes(gate.permission) === true;
  if (allowed) return;

  return NextResponse.redirect(new URL('/', req.nextUrl));
});

export const config = {
  // Skip static assets and Auth.js's own routes so the middleware doesn't
  // intercept the OAuth callback or token refresh. Static HTML pages are
  // matched explicitly by path because they live under /public and don't
  // share a common prefix with the Next routes.
  matcher: [
    '/admin/:path*',
    '/workout/:path*',
    '/spa/:path*',
    '/sex/:path*',
    '/family-tree/:path*',
    '/mekafkefim/:path*',
    '/instomit/:path*',
    '/trip.html',
    '/vegas-wedding-guide.html',
  ],
};
