// Local mode: sign in without Google on a dev server (`npm run dev:local`).
// All three must hold, so it can never switch on in a deployment:
// a `next dev` server, LOCAL_DEV_LOGIN=1, and a localhost Host header.
// Import-free apart from the owner list, so the middleware can use it.
import { OWNER_EMAILS } from '@/types/auth';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export const LOCAL_DEV_LOGIN_PATH = '/api/dev/login';

export function localDevLoginEnabled(host: string | null): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.LOCAL_DEV_LOGIN === '1' &&
    LOCAL_HOST.test(host ?? '')
  );
}

/** Who local mode signs in as: LOCAL_DEV_LOGIN_EMAIL, else the first owner. */
export function localDevLoginEmail(): string {
  return (process.env.LOCAL_DEV_LOGIN_EMAIL || OWNER_EMAILS[0]).toLowerCase();
}

/** A same-site path to return to, or "/". */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}

/**
 * Local-only tools (the gym backoffice): a `next dev` server reached on
 * localhost. Unlike local login it doesn't need LOCAL_DEV_LOGIN, so it also
 * works on plain `npm run dev` with a Google sign-in.
 */
export function localDevServer(host: string | null): boolean {
  return process.env.NODE_ENV === 'development' && LOCAL_HOST.test(host ?? '');
}
