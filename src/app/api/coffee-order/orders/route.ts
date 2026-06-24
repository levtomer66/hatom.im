import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { getCoffeeOrdersForUser, createCoffeeOrder } from '@/models/CoffeeOrder';
import {
  CreateCoffeeOrderDto,
  CoffeeOrder,
  isValidDrink,
  isValidMilk,
  isValidSugar,
  clampPumps,
  drinkSummary,
} from '@/types/coffee-order';

const NTFY_TOPIC = 'hatomim_coffee';

// Fire-and-forget push so whoever is making coffee sees the order land. Same
// pattern as notifySpaSchedule. ntfy.sh is already on the CSP connect-src
// allowlist (and this runs server-side anyway). Failure is logged, never
// blocks the response.
function notifyCoffeeOrder(order: CoffeeOrder): void {
  const when =
    order.deliveryType === 'scheduled' && order.scheduledAt
      ? order.scheduledAt
      : 'now';
  const bodyLines = [order.userName, drinkSummary(order), `When: ${when}`];
  if (order.notes.trim()) bodyLines.push(`Notes: ${order.notes.trim()}`);

  // ntfy Title is an HTTP header and must be ASCII. Strip non-ASCII from the
  // (possibly Hebrew/emoji) display name, falling back to the email local-part.
  const asciiName =
    order.userName.replace(/[^\x20-\x7E]/g, '').trim() ||
    order.userEmail.split('@')[0];

  fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    body: bodyLines.join('\n'),
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Title must be ASCII for ntfy.sh.
      Title: `New coffee order: ${asciiName}`,
      Tags: 'coffee',
    },
  }).catch((err) => {
    console.error('ntfy coffee notify failed', err);
  });
}

// GET — the signed-in user's own order history, newest first.
export async function GET() {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const orders = await getCoffeeOrdersForUser(email);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching coffee orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coffee orders' },
      { status: 500 }
    );
  }
}

// POST — place an order. Identity comes from the session; drink config is
// validated + clamped before persisting.
export async function POST(request: NextRequest) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;
  const userName = gate.session.user.name ?? email;

  try {
    const data = (await request.json()) as Partial<CreateCoffeeOrderDto>;

    if (!isValidDrink(data.drink)) {
      return NextResponse.json({ error: 'Invalid drink' }, { status: 400 });
    }
    if (!isValidMilk(data.milk)) {
      return NextResponse.json({ error: 'Invalid milk' }, { status: 400 });
    }
    if (!isValidSugar(data.sugar)) {
      return NextResponse.json({ error: 'Invalid sugar' }, { status: 400 });
    }
    if (data.deliveryType !== 'now' && data.deliveryType !== 'scheduled') {
      return NextResponse.json(
        { error: 'deliveryType must be "now" or "scheduled"' },
        { status: 400 }
      );
    }

    let scheduledAt: string | undefined;
    if (data.deliveryType === 'scheduled') {
      if (typeof data.scheduledAt !== 'string' || !data.scheduledAt.trim()) {
        return NextResponse.json(
          { error: 'scheduledAt is required for scheduled orders' },
          { status: 400 }
        );
      }
      const parsed = new Date(data.scheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'scheduledAt is not a valid date' },
          { status: 400 }
        );
      }
      scheduledAt = parsed.toISOString();
    }

    const notes = typeof data.notes === 'string' ? data.notes.slice(0, 500) : '';

    const order = await createCoffeeOrder({
      userEmail: email,
      userName,
      drink: data.drink,
      milk: data.milk,
      sugar: data.sugar,
      vanillaPumps: clampPumps(data.vanillaPumps),
      caramelPumps: clampPumps(data.caramelPumps),
      notes,
      deliveryType: data.deliveryType,
      // Only attach scheduledAt for scheduled orders so "now" docs stay clean.
      ...(scheduledAt ? { scheduledAt } : {}),
    });

    notifyCoffeeOrder(order);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating coffee order:', error);
    return NextResponse.json(
      { error: 'Failed to create coffee order' },
      { status: 500 }
    );
  }
}
