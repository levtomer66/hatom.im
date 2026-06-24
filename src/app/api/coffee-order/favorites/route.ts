import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import {
  getCoffeeFavoritesForUser,
  createCoffeeFavorite,
} from '@/models/CoffeeFavorite';
import {
  CreateCoffeeFavoriteDto,
  isValidDrink,
  isValidMilk,
  isValidSugar,
  clampPumps,
} from '@/types/coffee-order';

// GET — the signed-in user's own favorites, newest first.
export async function GET() {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const favorites = await getCoffeeFavoritesForUser(email);
    return NextResponse.json(favorites);
  } catch (error) {
    console.error('Error fetching coffee favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coffee favorites' },
      { status: 500 }
    );
  }
}

// POST — save a favorite drink config under a user-given name.
export async function POST(request: NextRequest) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const data = (await request.json()) as Partial<CreateCoffeeFavoriteDto>;

    if (typeof data.name !== 'string' || !data.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!isValidDrink(data.drink)) {
      return NextResponse.json({ error: 'Invalid drink' }, { status: 400 });
    }
    if (!isValidMilk(data.milk)) {
      return NextResponse.json({ error: 'Invalid milk' }, { status: 400 });
    }
    if (!isValidSugar(data.sugar)) {
      return NextResponse.json({ error: 'Invalid sugar' }, { status: 400 });
    }

    const favorite = await createCoffeeFavorite({
      userEmail: email,
      name: data.name.trim().slice(0, 60),
      drink: data.drink,
      milk: data.milk,
      sugar: data.sugar,
      vanillaPumps: clampPumps(data.vanillaPumps),
      caramelPumps: clampPumps(data.caramelPumps),
      notes: typeof data.notes === 'string' ? data.notes.slice(0, 500) : '',
    });

    return NextResponse.json(favorite, { status: 201 });
  } catch (error) {
    console.error('Error creating coffee favorite:', error);
    return NextResponse.json(
      { error: 'Failed to create coffee favorite' },
      { status: 500 }
    );
  }
}
