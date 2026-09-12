import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { getTasksForList, updateList, deleteListCascade, countArchives } from '@/models/Todo';
import { isTodoSortBy, type TodoListDetail, type TodoSortBy, type UpdateListDto } from '@/types/todo';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(request, id);
  if (access instanceof NextResponse) return access;
  try {
    const [tasks, archiveCount] = await Promise.all([getTasksForList(id), countArchives(id)]);
    const body: TodoListDetail = { list: access.list, tasks, archiveCount };
    return NextResponse.json(body);
  } catch (e) {
    console.error('todo list GET failed:', e);
    return NextResponse.json({ error: 'Failed to load list' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(request, id);
  if (access instanceof NextResponse) return access;
  try {
    const data = (await request.json()) as UpdateListDto;
    const patch: { name?: string; sortBy?: TodoSortBy; members?: string[] } = {};
    if (typeof data.name === 'string' && data.name.trim()) patch.name = data.name.trim();
    if (data.sortBy !== undefined) {
      if (!isTodoSortBy(data.sortBy)) return NextResponse.json({ error: 'bad sortBy' }, { status: 400 });
      patch.sortBy = data.sortBy;
    }
    if (data.members !== undefined) {
      // Explicit membership edits here are creator-only. (Tag-to-share is a
      // separate, add-only path: the task routes call addListMembers directly,
      // deliberately bypassing this guard so any member can share by tagging.)
      if (access.list.createdBy !== access.email) {
        return NextResponse.json({ error: 'Only the creator can change members' }, { status: 403 });
      }
      if (!Array.isArray(data.members)) return NextResponse.json({ error: 'bad members' }, { status: 400 });
      patch.members = [...new Set([
        access.list.createdBy,
        ...data.members.filter((m): m is string => typeof m === 'string'),
      ])];
    }
    if (Object.keys(patch).length === 0) return NextResponse.json(access.list);
    const updated = await updateList(id, patch);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('todo list PATCH failed:', e);
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(request, id);
  if (access instanceof NextResponse) return access;
  if (access.list.createdBy !== access.email) {
    return NextResponse.json({ error: 'Only the creator can delete the list' }, { status: 403 });
  }
  try {
    const ok = await deleteListCascade(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('todo list DELETE failed:', e);
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 });
  }
}
