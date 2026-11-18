import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { CITIES } from '@/lib/shopping/cities';
import { getShoppingSettings, updateShoppingSettings } from '@/models/ShoppingUserSettings';

// GET — the caller's /shopping preferences. PUT { nutritionHero?: boolean, city?: string | null } — change them.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json(await getShoppingSettings(caller.userEmail));
  } catch (error) {
    console.error('Error reading shopping settings:', error);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'shopping');
  if (caller instanceof NextResponse) return caller;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.nutritionHero !== undefined && typeof b.nutritionHero !== 'boolean') {
    return NextResponse.json({ error: 'nutritionHero must be a boolean' }, { status: 400 });
  }
  if (b.city !== undefined && b.city !== null && !CITIES.some((c) => c.id === b.city)) {
    return NextResponse.json({ error: 'unknown city' }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateShoppingSettings(caller.userEmail, {
      nutritionHero: b.nutritionHero as boolean | undefined,
      city: b.city as string | null | undefined,
    }));
  } catch (error) {
    console.error('Error saving shopping settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
