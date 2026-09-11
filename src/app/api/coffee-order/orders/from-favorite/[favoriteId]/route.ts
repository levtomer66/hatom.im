import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { isOwnerEmail } from '@/types/auth';
import { getCoffeeFavoriteById } from '@/models/CoffeeFavorite';
import { createCoffeeOrder } from '@/models/CoffeeOrder';
import { notifyCoffeeOrder } from '@/lib/coffee-notify';
import { orderDtoFromFavorite } from '@/types/coffee-order';

// POST — place a saved favorite as an order, right now. Session identity only;
// a caller may order their own favorite (owners may order anyone's). This is
// what the one-tap home-screen PWA page calls.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ favoriteId: string }> }
) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;
  const userName = gate.session.user.name ?? email;

  const { favoriteId } = await ctx.params;
  try {
    const fav = await getCoffeeFavoriteById(favoriteId);
    // 404 on missing OR someone else's favorite — but site owners may order any.
    if (!fav || (fav.userEmail !== email.toLowerCase() && !isOwnerEmail(email))) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }
    const order = await createCoffeeOrder({
      userEmail: email,
      userName,
      ...orderDtoFromFavorite(fav),
    });
    after(() => notifyCoffeeOrder(order));
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error ordering from favorite:', error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
