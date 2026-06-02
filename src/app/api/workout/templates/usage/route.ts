import { NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { getTemplateUsage } from '@/lib/workout-templates';

// GET /api/workout/templates/usage
// Owner-only. Returns { templateId → workout count } across all users for the
// owner's shared templates, so the selector can show "X sessions" badges.
// Non-owners get {}. (Logic lives in @/lib/workout-templates; the bootstrap
// endpoint reuses it.)
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const usage = await getTemplateUsage(userId);
    return NextResponse.json(usage);
  } catch (error) {
    console.error('Error fetching template usage:', error);
    return NextResponse.json({ error: 'Failed to fetch template usage' }, { status: 500 });
  }
}
