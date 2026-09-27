import { NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import {
  getUserApiSettings,
  regenerateUserApiKey,
  type PublicUserApiSettings,
} from '@/models/UserApiSettings';

// Personal API-key management. Reachable ONLY through an Auth.js session — a
// key can't manage itself. GET reveals the current key (or null), POST
// generates/rotates it.
function jsonSettings(settings: PublicUserApiSettings): NextResponse {
  return NextResponse.json(settings, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  try {
    return jsonSettings(
      await getUserApiSettings(gate.session.user.email, gate.session.user.name)
    );
  } catch (error) {
    console.error('Error fetching API settings:', error);
    return NextResponse.json({ error: 'Failed to fetch API settings' }, { status: 500 });
  }
}

export async function POST() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  try {
    return jsonSettings(
      await regenerateUserApiKey(gate.session.user.email, gate.session.user.name)
    );
  } catch (error) {
    console.error('Error generating API key:', error);
    return NextResponse.json({ error: 'Failed to generate API key' }, { status: 500 });
  }
}
