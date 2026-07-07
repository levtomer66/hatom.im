import { NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getAllCoffeeOrders } from '@/models/CoffeeOrder';
import { isBaristaEmail } from '@/types/coffee-order';

// GET — every user's orders for the barista board. Gated twice: the regular
// coffee-order permission, then the barista allowlist on top.
export async function GET() {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  if (!isBaristaEmail(gate.session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const orders = await getAllCoffeeOrders();
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching board orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch board orders' },
      { status: 500 }
    );
  }
}
