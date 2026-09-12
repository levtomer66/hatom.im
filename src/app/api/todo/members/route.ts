import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { getAppUserEmails } from '@/lib/todo-access';
import { getUserProfiles } from '@/models/UserProfile';
import { getUserDisplayName } from '@/types/workout';
import type { TodoMember } from '@/types/todo';

// Slim directory of app accounts for the member/assignee picker. The existing
// /api/admin/allowlist is owner-only; this one is available to any signed-in
// user who holds the `todo` permission. Each row carries the Google avatar +
// name when the user has signed in (via the Auth.js `users` collection).
export async function GET(request: NextRequest) {
  const gate = await requireFeatureCaller(request, 'todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const emails = new Set<string>(await getAppUserEmails());
    emails.add(gate.userEmail.toLowerCase());

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
