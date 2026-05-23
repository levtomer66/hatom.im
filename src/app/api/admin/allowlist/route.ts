import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-helpers';
import {
  addAuthorizedEmail,
  getAllAuthorizedEmails,
  removeAuthorizedEmail,
  setAllowedPages,
} from '@/models/AuthorizedEmail';
import { isOwnerEmail } from '@/types/auth';
import { parsePermissionKeyArray } from '@/types/permissions';

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

// Replace the full allowedPages array for one allowlisted user. Owners are
// never present in the collection (they hold every permission implicitly),
// so we reject attempts to PATCH an owner email with a clear error rather
// than silently 404-ing.
export async function PATCH(req: NextRequest) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;

  let body: { email?: unknown; allowedPages?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; allowedPages?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }
  if (isOwnerEmail(email)) {
    return NextResponse.json(
      { error: 'Owners already have every permission — nothing to set' },
      { status: 400 }
    );
  }

  const allowedPages = parsePermissionKeyArray(body.allowedPages);
  if (!allowedPages) {
    return NextResponse.json(
      { error: 'allowedPages must be an array of PermissionKey strings' },
      { status: 400 }
    );
  }

  const updated = await setAllowedPages(email, allowedPages);
  if (!updated) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
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
