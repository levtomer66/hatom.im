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
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: 'database' },
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
    // Decorate every session with the per-user permission grant. Owners
    // (Tom & Tomer) implicitly hold every PermissionKey; everyone else
    // gets the array stored on their `authorizedEmails` row. Anonymous /
    // missing-email sessions land here as `allowedPages: []`, which the
    // `hasPermission` helper treats as no access.
    async session({ session }) {
      session.user.isOwner = isOwnerEmail(session.user?.email);
      if (session.user.isOwner) {
        session.user.allowedPages = [...PERMISSION_KEYS];
      } else if (session.user?.email) {
        const entry = await getAuthorizedEmailEntry(session.user.email);
        session.user.allowedPages = entry?.allowedPages ?? [];
      } else {
        session.user.allowedPages = [];
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login', // surface AccessDenied on the same screen
  },
});
