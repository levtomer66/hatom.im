import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { requireFeatureCaller } from '@/lib/api-caller';
import { notifyCoffeeOrder } from '@/lib/coffee-notify';
import { getCoffeeOrdersForUser, createCoffeeOrder } from '@/models/CoffeeOrder';
import { getCoffeeFavoriteForUser } from '@/models/CoffeeFavorite';
import {
  CreateCoffeeOrderDto,
  isValidDrink,
  isValidMilk,
  isValidSugar,
  resolveSource,
  resolveCapsule,
  resolveGlassColor,
  clampPumps,
  orderDtoFromFavorite,
  defaultDrinkConfig,
} from '@/types/coffee-order';

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

// POST — place an order. Two callers:
//   • Session (browser): the full CreateCoffeeOrderDto body, validated + clamped.
//   • Personal API key (Shortcut / macOS / MCP): NO body — orders the caller's
//     chosen default favorite (or built-in defaults), always delivered "now".
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'coffee-order');
  if (caller instanceof NextResponse) return caller;

  if (caller.authMode === 'api-key') {
    // An absent or empty body is expected. A body WITH fields is rejected so a
    // client never believes per-request overrides were applied — the drink is
    // configured once, in settings, as the default favorite.
    let raw: unknown;
    try {
      const text = await request.text();
      raw = text.trim() ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (
      raw &&
      typeof raw === 'object' &&
      (Array.isArray(raw) ? raw.length > 0 : Object.keys(raw).length > 0)
    ) {
      return NextResponse.json(
        { error: 'API-key orders take no body; pick a default favorite in settings' },
        { status: 400 }
      );
    }
    try {
      const fav = caller.defaultCoffeeFavoriteId
        ? await getCoffeeFavoriteForUser(caller.defaultCoffeeFavoriteId, caller.userEmail)
        : null;
      // A deleted/foreign/absent default silently falls back to built-in defaults.
      const dto = fav
        ? orderDtoFromFavorite(fav)
        : { ...defaultDrinkConfig(), deliveryType: 'now' as const };
      const order = await createCoffeeOrder({
        userEmail: caller.userEmail,
        userName: caller.userName,
        ...dto,
      });
      after(() => notifyCoffeeOrder(order));
      return NextResponse.json(order, { status: 201 });
    } catch (error) {
      console.error('Error creating coffee order (api-key):', error);
      return NextResponse.json({ error: 'Failed to create coffee order' }, { status: 500 });
    }
  }

  // Session mode — unchanged behavior.
  const email = caller.userEmail;
  const userName = caller.userName;

  let data: Partial<CreateCoffeeOrderDto>;
  try {
    data = (await request.json()) as Partial<CreateCoffeeOrderDto>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    if (!isValidDrink(data.drink)) {
      return NextResponse.json({ error: 'Invalid drink' }, { status: 400 });
    }
    if (!isValidMilk(data.milk)) {
      return NextResponse.json({ error: 'Invalid milk' }, { status: 400 });
    }
    if (!isValidSugar(data.sugar)) {
      return NextResponse.json({ error: 'Invalid sugar' }, { status: 400 });
    }
    const source = resolveSource(data.source);
    if (!source) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }
    const capsule = resolveCapsule(data.capsule);
    if (!capsule) {
      return NextResponse.json({ error: 'Invalid capsule' }, { status: 400 });
    }
    const glassColor = resolveGlassColor(data.glassColor);
    if (!glassColor) {
      return NextResponse.json({ error: 'Invalid glass color' }, { status: 400 });
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
      source,
      capsule,
      glassColor,
      vanillaPumps: clampPumps(data.vanillaPumps),
      caramelPumps: clampPumps(data.caramelPumps),
      notes,
      deliveryType: data.deliveryType,
      // Only attach scheduledAt for scheduled orders so "now" docs stay clean.
      ...(scheduledAt ? { scheduledAt } : {}),
    });

    after(() => notifyCoffeeOrder(order));
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating coffee order:', error);
    return NextResponse.json(
      { error: 'Failed to create coffee order' },
      { status: 500 }
    );
  }
}
