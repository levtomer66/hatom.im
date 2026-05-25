import { NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';

const NTFY_TOPIC = 'hatomim_access_request';

// POST /api/access-request
// Any signed-in user (even one with zero granted pages) can ping the
// owner via ntfy.sh asking to be granted access. Identity is taken from
// the session, not the request body, so the user can't impersonate
// someone else. Fire-and-forget — failure to reach ntfy.sh is logged
// but doesn't fail the request.
export async function POST() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;
  const name = gate.session.user.name ?? email;

  const body = [
    `${name} <${email}> requested access.`,
    `Grant at https://www.hatom.im/admin/allowlist`,
  ].join('\n');

  fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      Title: 'hatom.im access request',
      Tags: 'key,wave',
    },
  }).catch((err) => {
    console.error('ntfy access-request notify failed', err);
  });

  return NextResponse.json({ ok: true });
}
