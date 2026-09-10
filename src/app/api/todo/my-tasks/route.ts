import { NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getTasksAssignedTo } from '@/models/Todo';

// Open tasks assigned to the caller across all lists. The client maps each
// task's listId to a name using the lists it already fetched from /api/todo/lists
// (the caller is always a member of any list they're assigned in).
export async function GET() {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const tasks = await getTasksAssignedTo(gate.session.user.email);
    return NextResponse.json(tasks);
  } catch (e) {
    console.error('todo my-tasks GET failed:', e);
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}
