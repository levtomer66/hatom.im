import { NextRequest, NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { deleteFeedPost } from '@/models/WorkoutFeedPost';

// DELETE /api/workout/feed/[workoutId]
// Unshare — own posts only. Re-sharing afterward is allowed and refreshes the
// snapshot (there is no edit endpoint; unshare + reshare is the escape hatch).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workoutId: string }> },
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const { workoutId } = await params;
    const deleted = await deleteFeedPost(workoutId, userId);
    if (!deleted) {
      // Either it didn't exist or it isn't the caller's — 404 either way so we
      // don't leak the existence of another user's post.
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unsharing workout:', error);
    return NextResponse.json({ error: 'Failed to unshare' }, { status: 500 });
  }
}
