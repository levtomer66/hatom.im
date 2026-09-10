import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { createTask } from '@/models/Todo';
import { notifyAssignment } from '@/lib/todo-notify';
import type { CreateTaskDto } from '@/types/todo';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const data = (await request.json()) as CreateTaskDto;
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
    const assignees = Array.isArray(data.assignees)
      ? [...new Set(data.assignees.filter((e) => access.list.members.includes(e)))]
      : [];
    const dueDate = typeof data.dueDate === 'string' && YMD.test(data.dueDate) ? data.dueDate : undefined;
    const description = typeof data.description === 'string' && data.description.trim()
      ? data.description.trim() : undefined;
    const task = await createTask(id, { text, assignees, dueDate, description, createdBy: access.email });
    if (assignees.length) {
      await notifyAssignment(access.list.notifyTopic, { taskText: text, assignees, byEmail: access.email });
    }
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error('todo task POST failed:', e);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
