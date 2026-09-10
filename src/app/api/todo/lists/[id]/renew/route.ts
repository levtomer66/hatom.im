import { NextRequest, NextResponse } from 'next/server';
import { requireListMember } from '@/lib/todo-access';
import { renewList } from '@/models/Todo';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await requireListMember(id);
  if (access instanceof NextResponse) return access;
  try {
    const archive = await renewList(id, access.email);
    if (!archive) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(archive, { status: 201 });
  } catch (e) {
    console.error('todo renew failed:', e);
    return NextResponse.json({ error: 'Failed to renew list' }, { status: 500 });
  }
}
