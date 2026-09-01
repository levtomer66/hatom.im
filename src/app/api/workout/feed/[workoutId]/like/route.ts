import { NextRequest, NextResponse } from 'next/server';
import { requireSignedIn } from '@/lib/auth-helpers';
import { getFeedPostByWorkoutId, toggleLike } from '@/models/WorkoutFeedPost';

// POST /api/workout/feed/[workoutId]/like
// Toggles the caller's 💪 on a shared workout. Per-user (one like per person),
// idempotent per tap. You can't like your own post (403).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ workoutId: string }> },
) {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const { workoutId } = await params;

    const post = await getFeedPostByWorkoutId(workoutId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (post.userId === userId) {
      return NextResponse.json({ error: "Can't like your own post" }, { status: 403 });
    }

    const result = await toggleLike(workoutId, userId);
    if (!result) {
      // Deleted between the read and the write — treat as gone.
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error toggling feed like:', error);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}
