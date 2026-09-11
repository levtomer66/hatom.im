import { NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getAllAuthorizedEmails } from '@/models/AuthorizedEmail';
import { getUserProfiles } from '@/models/UserProfile';
import { OWNER_EMAILS } from '@/types/auth';
import { getUserDisplayName } from '@/types/workout';
import type { TodoMember } from '@/types/todo';

// Slim directory of app accounts for the member/assignee picker. The existing
// /api/admin/allowlist is owner-only; this one is available to any signed-in
// user who holds the `todo` permission. Each row carries the Google avatar +
// name when the user has signed in (via the Auth.js `users` collection).
export async function GET() {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const rows = await getAllAuthorizedEmails();
    const emails = new Set<string>(rows.map((r) => r.email.toLowerCase()));
    for (const o of OWNER_EMAILS) emails.add(o.toLowerCase());
    emails.add(gate.session.user.email.toLowerCase());

    const list = [...emails].sort();
    const profiles = await getUserProfiles(list);
    const members: TodoMember[] = list.map((email) => {
      const p = profiles[email];
      return { email, name: p?.name || getUserDisplayName(email), image: p?.image };
    });
    return NextResponse.json(members);
  } catch (e) {
    console.error('todo members GET failed:', e);
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }
}
