import { NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { signPagingShortcutToken } from '@/lib/paging-shortcut-token';

export async function POST() {
  const gate = await requirePagePermission('paging');
  if (gate instanceof NextResponse) return gate;
  try {
    const token = signPagingShortcutToken(gate.session.user.email);
    return NextResponse.json(
      { token },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    console.error('[paging] Shortcut token signing is not configured');
    return NextResponse.json(
      { error: 'Shortcut setup is not configured' },
      { status: 503 }
    );
  }
}
