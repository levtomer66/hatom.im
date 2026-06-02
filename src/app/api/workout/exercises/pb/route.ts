import { NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { getCachedPersonalBests } from '@/lib/workout-pb';

// GET /api/workout/exercises/pb
// All personal bests for the signed-in user, keyed by exerciseId. PB is
// computed via Epley e1RM (rep cap 10) so 100×5 (strength) and 80×10
// (hypertrophy) are comparable on a unified scale. The heavy full-collection
// compute lives in @/lib/workout-pb and is memoized per user (5-min TTL + tag
// invalidation on every workout write); the bootstrap endpoint shares the same
// cached result.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const pbMap = await getCachedPersonalBests(userId);
    return NextResponse.json(pbMap);
  } catch (error) {
    console.error('Error fetching personal bests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personal bests' },
      { status: 500 }
    );
  }
}
