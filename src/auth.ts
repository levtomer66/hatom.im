import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';
import { isOwnerEmail } from '@/types/auth';
import { PERMISSION_KEYS } from '@/types/permissions';
import {
  getAuthorizedEmailEntry,
  isEmailAuthorized,
} from '@/models/AuthorizedEmail';

// Surface a missing-config one-liner at server startup so a forgotten
// Vercel env var doesn't only manifest as a confusing 500 deep inside the
// OAuth callback. Warn rather than throw so `next build` still works in
// CI shells where the secret isn't injected. Skip during the static
// build phase — env vars are injected at deploy time, not build time,
// and Husky `next build` locally would otherwise spam the warning.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PHASE !== 'phase-production-build' &&
  (!process.env.AUTH_GOOGLE_ID ||
    !process.env.AUTH_GOOGLE_SECRET ||
    !process.env.AUTH_SECRET)
) {
  console.warn(
    '[auth] AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTH_SECRET missing — Google sign-in will fail.'
  );
}

// PR 1 of the SSO rollout: this enables Google sign-in but does not yet
// enforce the allowlist (that lands in PR 2). For now any Google account
// can sign in — useful so we can wire up the OAuth client without first
// having to seed the `authorizedEmails` collection.
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Adapter is kept for OAuth user/account persistence. With the JWT
  // strategy below it no longer writes `sessions` docs — the session lives
  // in a signed cookie instead, so `auth()` reads it without a Mongo round
  // trip. (Switching off `database` sessions invalidates existing sessions:
  // everyone re-logs-in once.)
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    // Allowlist gate. Owners (Tom & Tomer) are implicitly allowed; everyone
    // else must have their email present in the `authorizedEmails`
    // collection (managed via /admin/allowlist). Returning false sends the
    // user to /login?error=AccessDenied.
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      if (isOwnerEmail(email)) return true;
      return await isEmailAuthorized(email);
    },
    // Token enrichment — the hot path. `auth()` runs in middleware, the
    // root layout, and every API route's `requireSignedIn`; under database
    // sessions each of those was a `sessions` lookup (~600-800ms on M0,
    // measured). The token now caches the non-owner permission grant so the
    // `session` callback (below) never queries Mongo.
    //
    // The `authorizedEmails` row is re-read only when:
    //   • signing in (`user` present), or
    //   • the client calls `update()` (`trigger === 'update'`), or
    //   • the cached copy is older than PERMS_TTL_MS.
    // The TTL bounds how long a revoked grant survives (≈10 min) while still
    // skipping Mongo on virtually every request. Owners are a pure email
    // check and never read Mongo here — their grant is filled in `session`.
    async jwt({ token, user, trigger }) {
      const email = (user?.email ?? token.email)?.toLowerCase() ?? null;
      if (isOwnerEmail(email)) {
        // Owner grant is code-derived; don't cache/refresh a DB copy.
        delete token.allowedPages;
        delete token.permsCheckedAt;
        return token;
      }
      if (!email) {
        // Fail closed: a token with no resolvable email gets no grant,
        // even if a malformed/legacy token carried a stale one.
        delete token.allowedPages;
        delete token.permsCheckedAt;
        return token;
      }
      const PERMS_TTL_MS = 10 * 60 * 1000;
      const stale =
        typeof token.permsCheckedAt !== 'number' ||
        Date.now() - token.permsCheckedAt > PERMS_TTL_MS;
      if (Boolean(user) || trigger === 'update' || stale) {
        const entry = await getAuthorizedEmailEntry(email);
        token.allowedPages = entry?.allowedPages ?? [];
        token.permsCheckedAt = Date.now();
      }
      return token;
    },
    // Materialise the session from the token only — zero Mongo. Owners
    // (Tomer) implicitly hold every PermissionKey; everyone else gets the
    // token-cached grant. Anonymous / missing-email sessions land here as
    // `allowedPages: []`, which `hasPermission` treats as no access.
    async session({ session, token }) {
      const owner = isOwnerEmail(session.user?.email);
      session.user.isOwner = owner;
      session.user.allowedPages = owner
        ? [...PERMISSION_KEYS]
        : token.allowedPages ?? [];
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login', // surface AccessDenied on the same screen
  },
});
