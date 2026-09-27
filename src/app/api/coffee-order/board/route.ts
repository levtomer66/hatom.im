import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { getAllCoffeeOrders } from '@/models/CoffeeOrder';
import { isBaristaEmail } from '@/types/coffee-order';

// GET — every user's orders for the barista board. Gated twice: the regular
// coffee-order permission, then the barista allowlist on top. Session OR
// personal key (the Hatom Pager menu-bar app polls this with the key).
export async function GET(request: NextRequest) {
  const gate = await requireFeatureCaller(request, 'coffee-order');
  if (gate instanceof NextResponse) return gate;
  if (!isBaristaEmail(gate.userEmail)) {
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
