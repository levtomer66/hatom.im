import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { createTask } from '@/models/Todo';
import { notifyAssignment } from '@/lib/todo-notify';
import { isYmd, sanitizeAssignees, normalizeColumn, type CreateTaskDto } from '@/types/todo';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const data = (await request.json()) as CreateTaskDto;
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
    const assignees = sanitizeAssignees(data.assignees, access.list.members);
    const dueDate = isYmd(data.dueDate) ? data.dueDate : undefined;
    const description = typeof data.description === 'string' && data.description.trim()
      ? data.description.trim() : undefined;
    const column = normalizeColumn(data.column);
    const task = await createTask(id, { text, column, assignees, dueDate, description, createdBy: access.email });
    if (assignees.length) {
      await notifyAssignment(access.list.notifyTopic, { taskText: text, assignees, byEmail: access.email });
    }
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error('todo task POST failed:', e);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
