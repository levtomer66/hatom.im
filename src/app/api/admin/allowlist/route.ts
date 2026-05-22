import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-helpers';
import {
  addAuthorizedEmail,
  getAllAuthorizedEmails,
  removeAuthorizedEmail,
} from '@/models/AuthorizedEmail';
import { isOwnerEmail } from '@/types/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;

  const list = await getAllAuthorizedEmails();
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;
  const { session } = gate;

  let body: { email?: unknown; note?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }
  if (isOwnerEmail(email)) {
    return NextResponse.json(
      { error: 'Owners are always allowed — no need to add' },
      { status: 400 }
    );
  }

  const note = typeof body.note === 'string' ? body.note.slice(0, 200) : undefined;
  const addedBy = session.user.email;
  const entry = await addAuthorizedEmail(email, addedBy, note);
  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }
  if (isOwnerEmail(email)) {
    return NextResponse.json(
      { error: 'Cannot remove an owner from the allowlist' },
      { status: 400 }
    );
  }

  const removed = await removeAuthorizedEmail(email);
  if (!removed) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
