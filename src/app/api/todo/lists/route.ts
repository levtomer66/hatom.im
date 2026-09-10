import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getListsForMember, createList } from '@/models/Todo';
import type { CreateListDto } from '@/types/todo';

export async function GET() {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const lists = await getListsForMember(gate.session.user.email);
    return NextResponse.json(lists);
  } catch (e) {
    console.error('todo lists GET failed:', e);
    return NextResponse.json({ error: 'Failed to load lists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requirePagePermission('todo');
  if (gate instanceof NextResponse) return gate;
  try {
    const data = (await request.json()) as CreateListDto;
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const members = Array.isArray(data.members)
      ? data.members.filter((m): m is string => typeof m === 'string')
      : [];
    const list = await createList({ name, members, createdBy: gate.session.user.email });
    return NextResponse.json(list, { status: 201 });
  } catch (e) {
    console.error('todo lists POST failed:', e);
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}
