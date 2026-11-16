import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import {
  localDevLoginEmail,
  localDevLoginEnabled,
  safeNextPath,
} from '@/lib/local-dev-login';

// GET ?next=/path — local mode only (see src/lib/local-dev-login.ts): mints
// the same session cookie a Google sign-in would, then redirects. Anywhere
// else this route does not exist (404).
const COOKIE = 'authjs.session-token'; // the http:// (non-__Secure-) name
const MAX_AGE = 30 * 24 * 60 * 60;

export async function GET(request: NextRequest) {
  if (!localDevLoginEnabled(request.headers.get('host')) || !process.env.AUTH_SECRET) {
    return new NextResponse('Not found', { status: 404 });
  }
  const email = localDevLoginEmail();
  const token = await encode({
    token: { email, name: `Local (${email.split('@')[0]})`, sub: `local:${email}` },
    secret: process.env.AUTH_SECRET,
    salt: COOKIE,
    maxAge: MAX_AGE,
  });
  const res = NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.nextUrl));
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: MAX_AGE });
  return res;
}
