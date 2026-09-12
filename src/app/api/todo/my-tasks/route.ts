import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { getTasksAssignedTo } from '@/models/Todo';

// Open tasks assigned to the caller across all lists. The client maps each
// task's listId to a name using the lists it already fetched from /api/todo/lists
// (the caller is always a member of any list they're assigned in).
export async function GET(request: NextRequest) {
  const gate = await requireFeatureCaller(request, 'todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const tasks = await getTasksAssignedTo(gate.userEmail);
    return NextResponse.json(tasks);
  } catch (e) {
    console.error('todo my-tasks GET failed:', e);
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}
