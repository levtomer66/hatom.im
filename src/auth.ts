import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';
import { isOwnerEmail } from '@/types/auth';

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
