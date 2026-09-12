import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
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

// Gate on the `todo` permission (session OR personal key), load the list, and
// confirm the caller is a member — all in one call. A non-member (or missing
// list) gets a 404, not a 403, so list existence isn't leaked to outsiders.
export async function requireListMember(
  request: NextRequest,
  listId: string
): Promise<
  { email: string; userName: string; list: TodoList } | NextResponse
> {
  const caller = await requireFeatureCaller(request, 'todo');
  if (caller instanceof NextResponse) return caller;
  const email = caller.userEmail;
  const list = await getListById(listId);
  if (!list || !list.members.includes(email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return { email, userName: caller.userName, list };
}
