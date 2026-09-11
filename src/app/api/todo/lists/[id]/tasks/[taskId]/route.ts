import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { getTaskById, updateTask, deleteTask } from '@/models/Todo';
import { notifyAssignment } from '@/lib/todo-notify';
import { isYmd, sanitizeAssignees, normalizeColumn, type UpdateTaskDto } from '@/types/todo';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const existing = await getTaskById(id, taskId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = (await request.json()) as UpdateTaskDto;
    const patch: Parameters<typeof updateTask>[2] = {};
    if (typeof data.text === 'string' && data.text.trim()) patch.text = data.text.trim();
    if (data.column !== undefined) patch.column = normalizeColumn(data.column);
    if (data.assignees !== undefined) {
      if (!Array.isArray(data.assignees)) return NextResponse.json({ error: 'bad assignees' }, { status: 400 });
      patch.assignees = sanitizeAssignees(data.assignees, access.list.members);
    }
    if (data.dueDate !== undefined) {
      if (data.dueDate === null) patch.dueDate = null;
      else if (isYmd(data.dueDate)) patch.dueDate = data.dueDate;
      else return NextResponse.json({ error: 'bad dueDate' }, { status: 400 });
    }
    if (data.description !== undefined) {
      patch.description = data.description === null ? null : (String(data.description).trim() || null);
    }
    if (data.done !== undefined) { patch.done = !!data.done; if (data.done) patch.doneBy = access.email; }
    const updated = await updateTask(id, taskId, patch);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (patch.assignees) {
      const added = patch.assignees.filter((e) => !existing.assignees.includes(e));
      if (added.length) {
        await notifyAssignment(access.list.notifyTopic, { taskText: updated.text, assignees: added, byEmail: access.email });
      }
    }
    return NextResponse.json(updated);
  } catch (e) {
    console.error('todo task PATCH failed:', e);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const ok = await deleteTask(id, taskId);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('todo task DELETE failed:', e);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
