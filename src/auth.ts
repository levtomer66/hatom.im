import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';
import { isOwnerEmail } from '@/types/auth';

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
    // Decorate every session with an `isOwner` flag derived from email.
    // Pages/APIs read this instead of re-checking the email against the
    // OWNER_EMAILS list at every call site.
    async session({ session }) {
      session.user.isOwner = isOwnerEmail(session.user?.email);
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
