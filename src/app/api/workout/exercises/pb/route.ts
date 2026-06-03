import { NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { getStoredPersonalBests } from '@/lib/workout-pb';

// GET /api/workout/exercises/pb
// All personal bests for the signed-in user, keyed by exerciseId. PB is
// computed via Epley e1RM (rep cap 10) so 100×5 (strength) and 80×10
// (hypertrophy) are comparable on a unified scale. Reads from the materialized
// per-user PersonalBestStore (a single O(1) doc fetch); the heavy scan in
// @/lib/workout-pb only runs when a workout is completed or deleted. The
// bootstrap endpoint reads from the same store.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const pbMap = await getStoredPersonalBests(userId);
    return NextResponse.json(pbMap);
  } catch (error) {
    console.error('Error fetching personal bests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personal bests' },
      { status: 500 }
    );
  }
}
