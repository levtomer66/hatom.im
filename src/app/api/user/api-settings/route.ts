import { NextRequest, NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { getCoffeeFavoriteForUser } from '@/models/CoffeeFavorite';
import {
  getUserApiSettings,
  regenerateUserApiKey,
  setDefaultCoffeeFavorite,
  type PublicUserApiSettings,
} from '@/models/UserApiSettings';

// Personal API-key management. Reachable ONLY through an Auth.js session — a
// key can't manage itself. GET reveals the current key (or null), POST
// generates/rotates it, PATCH sets the default coffee favorite.
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

export async function PATCH(request: NextRequest) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await request.json()) as unknown;
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(body, 'defaultCoffeeFavoriteId')
    ) {
      return NextResponse.json({ error: 'Invalid settings body' }, { status: 400 });
    }
    const favoriteId = (body as Record<string, unknown>).defaultCoffeeFavoriteId;
    if (favoriteId !== null && (typeof favoriteId !== 'string' || favoriteId.length === 0)) {
      return NextResponse.json({ error: 'Invalid defaultCoffeeFavoriteId' }, { status: 400 });
    }
    if (favoriteId) {
      const favorite = await getCoffeeFavoriteForUser(favoriteId, gate.session.user.email);
      if (!favorite) {
        return NextResponse.json(
          { error: 'Favorite does not belong to this user' },
          { status: 400 }
        );
      }
    }
    return jsonSettings(
      await setDefaultCoffeeFavorite(
        gate.session.user.email,
        gate.session.user.name,
        favoriteId
      )
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    console.error('Error updating API settings:', error);
    return NextResponse.json({ error: 'Failed to update API settings' }, { status: 500 });
  }
}
