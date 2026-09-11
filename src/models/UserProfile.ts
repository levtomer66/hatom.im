import clientPromise from '@/lib/mongodb';

// Auth.js (@auth/mongodb-adapter) stores signed-in users in the `users`
// collection with { name, email, image }. We read it (never write) so the
// ToDo member picker and assignee chips can show real Google avatars + names.
const USERS = 'users';

export interface UserProfile {
  name?: string;
  image?: string;
}

// Look up profiles for a set of emails. Returns a map keyed by LOWERCASED email.
// Emails with no adapter user (allowlisted but never signed in) are simply absent.
export async function getUserProfiles(emails: string[]): Promise<Record<string, UserProfile>> {
  const out: Record<string, UserProfile> = {};
  if (emails.length === 0) return out;
  try {
    const client = await clientPromise;
    const lowered = [...new Set(emails.map((e) => e.toLowerCase()))];
    const docs = await client
      .db()
      .collection<{ email?: string; name?: string; image?: string }>(USERS)
      .find({ email: { $in: lowered } })
      .toArray();
    for (const d of docs) {
      if (!d.email) continue;
      out[d.email.toLowerCase()] = { name: d.name, image: d.image };
    }
  } catch (e) {
    console.error('getUserProfiles failed:', e);
  }
  return out;
}
