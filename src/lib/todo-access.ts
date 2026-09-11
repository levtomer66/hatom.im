import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getListById } from '@/models/Todo';
import { getAllAuthorizedEmails } from '@/models/AuthorizedEmail';
import { OWNER_EMAILS } from '@/types/auth';
import type { TodoList } from '@/types/todo';

// The set of app accounts anyone can be tagged/shared with — every allowlisted
// email plus the owners, lowercased. Used to validate task assignees (tagging a
// user shares the list with them, so we only accept real accounts).
export async function getAppUserEmails(): Promise<string[]> {
  const rows = await getAllAuthorizedEmails();
  const set = new Set<string>(rows.map((r) => r.email.toLowerCase()));
  for (const o of OWNER_EMAILS) set.add(o.toLowerCase());
  return [...set];
}

// Gate on the `todo` permission, load the list, and confirm the caller is a
// member — all in one call. A non-member (or missing list) gets a 404, not a
// 403, so list existence isn't leaked to outsiders.
export async function requireListMember(listId: string): Promise<
  | { session: Session & { user: { email: string } }; email: string; list: TodoList }
  | NextResponse
> {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;
  const list = await getListById(listId);
  if (!list || !list.members.includes(email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return { session: gate.session, email, list };
}
