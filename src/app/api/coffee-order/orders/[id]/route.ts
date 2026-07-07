import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { isOwnerEmail } from '@/types/auth';
import { deleteCoffeeOrder, setCoffeeOrderStatus } from '@/models/CoffeeOrder';
import { isBaristaEmail } from '@/types/coffee-order';

// PATCH — flip an order's status (open ⇄ done). Barista only.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  if (!isBaristaEmail(gate.session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body.status !== 'open' && body.status !== 'done') {
    return NextResponse.json(
      { error: 'status must be "open" or "done"' },
      { status: 400 }
    );
  }

  try {
    const { id } = await context.params;
    const updated = await setCoffeeOrderStatus(id, body.status);
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating coffee order:', error);
    return NextResponse.json(
      { error: 'Failed to update coffee order' },
      { status: 500 }
    );
  }
}

// DELETE — cancel an order. A user can delete their own; owners can delete any.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const { id } = await context.params;
    const ok = await deleteCoffeeOrder(id, email, isOwnerEmail(email));
    if (!ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting coffee order:', error);
    return NextResponse.json(
      { error: 'Failed to delete coffee order' },
      { status: 500 }
    );
  }
}
