import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { getArchivesForList } from '@/models/Todo';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(request, id);
  if (access instanceof NextResponse) return access;
  try {
    const archives = await getArchivesForList(id);
    return NextResponse.json(archives);
  } catch (e) {
    console.error('todo archives GET failed:', e);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
