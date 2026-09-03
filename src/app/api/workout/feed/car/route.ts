import { NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { getUserDisplayName } from '@/types/workout';
import { getFeedTotals } from '@/models/WorkoutFeedPost';

// GET /api/workout/feed/car
// Totals behind "The Moving Car" on the feed: the sum of every shared
// workout's volume (all users, all time) plus a per-sharer breakdown. The
// level / track position is NOT computed here — the client derives it with
// the pure `computeCarState(totalKg)` so there is a single source of truth
// and nothing to keep in sync. Any signed-in user sees the group's totals.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;

  try {
    const totals = await getFeedTotals();
    return NextResponse.json({
      totalKg: totals.totalKg,
      postCount: totals.postCount,
      byUser: totals.byUser.map((u) => ({ ...u, displayName: getUserDisplayName(u.userId) })),
    });
  } catch (error) {
    console.error('Error computing feed car totals:', error);
    return NextResponse.json({ error: 'Failed to load car totals' }, { status: 500 });
  }
}
