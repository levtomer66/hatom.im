import { NextRequest, NextResponse } from 'next/server';
import { requirePagePermission } from '@/lib/auth-helpers';
import { isOwnerEmail } from '@/types/auth';
import { deleteCoffeeFavorite } from '@/models/CoffeeFavorite';

// DELETE — remove a favorite. A user can delete their own; owners can delete any.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePagePermission('coffee-order');
  if (gate instanceof NextResponse) return gate;
  const email = gate.session.user.email;

  try {
    const { id } = await context.params;
    const ok = await deleteCoffeeFavorite(id, email, isOwnerEmail(email));
    if (!ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting coffee favorite:', error);
    return NextResponse.json(
      { error: 'Failed to delete coffee favorite' },
      { status: 500 }
    );
  }
}
