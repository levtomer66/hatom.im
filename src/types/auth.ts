// Email-based identity model. Auth.js stores users by their Gmail address;
// these two are the privileged owners of the site. Everyone else who can
// sign in must be present in the `authorizedEmails` Mongo collection.
export const OWNER_EMAILS = [
  'tomzari347@gmail.com',  // Tom
  'levtomer66@gmail.com',  // Tomer
] as const;

export type OwnerEmail = (typeof OWNER_EMAILS)[number];

// Pre-folded lookup so a future capital-letter typo in OWNER_EMAILS can't
// silently lock an owner out — compare lowercase on both sides.
const OWNER_EMAIL_SET = new Set<string>(OWNER_EMAILS.map((e) => e.toLowerCase()));

export function isOwnerEmail(email: string | null | undefined): email is OwnerEmail {
  if (!email) return false;
  return OWNER_EMAIL_SET.has(email.toLowerCase());
}

// Augment the next-auth Session type so `session.user.isOwner` is
// statically known everywhere we read it.
declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isOwner: boolean;
    };
  }
}
