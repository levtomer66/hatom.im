import { NextRequest, NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { deleteGrantForUser, listGrantsForUser } from '@/models/OAuthGrant';

// "Connected apps" for the API-settings dialog. Session-only — an OAuth token
// can't list or revoke grants. DELETE is scoped to the caller's own grants.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  try {
    return NextResponse.json(await listGrantsForUser(gate.session.user.email), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error listing OAuth grants:', error);
    return NextResponse.json({ error: 'Failed to list connected apps' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    const deleted = await deleteGrantForUser(id, gate.session.user.email);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error revoking OAuth grant:', error);
    return NextResponse.json({ error: 'Failed to disconnect app' }, { status: 500 });
  }
}
