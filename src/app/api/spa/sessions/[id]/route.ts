import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { deleteSpaSession } from '@/models/SpaSession';
import { requireSpaUser } from '@/lib/auth-helpers';

// DELETE /api/spa/sessions/[id]
// SPA_USERS only (Tom or Tomer). Independent of site-wide ownership so
// Tom keeps his delete-permission even after being managed via the
// allowlist matrix. Permanent removal — no soft-delete because the spa
// session list is intentionally tiny and we don't keep an audit log.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSpaUser();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  }

  try {
    const removed = await deleteSpaSession(id);
    if (!removed) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting spa session:', error);
    return NextResponse.json(
      { error: 'Failed to delete spa session' },
      { status: 500 }
    );
  }
}
