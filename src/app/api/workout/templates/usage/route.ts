import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import WorkoutTemplateModel from '@/models/WorkoutTemplate';
import { requireSignedIn } from '@/lib/auth-helpers';
import { isOwnerEmail, OWNER_EMAILS } from '@/types/auth';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// GET /api/workout/templates/usage
// Owner-only. Returns a count of workouts (any user) per templateId for
// every template marked sharedByOwner. Used by the TemplateSelector to
// show "X sessions" badges on the owner's own shared templates so the
// owner can see who's running their stuff. The counts include workouts
// from the owner themselves — distinguishing "by me" vs "by others"
// would need session attribution that we don't capture today.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;
  // Cheap gate: only owners get the usage map. Non-owners would just see
  // their own stats anyway, which the UI doesn't surface.
  if (!isOwnerEmail(userId)) {
    return NextResponse.json({});
  }

  try {
    await connectDB();

    const sharedTemplates = await WorkoutTemplateModel
      .find({ sharedByOwner: true, userId: { $in: OWNER_EMAILS } }, { _id: 1 })
      .lean();
    const ids = sharedTemplates.map((t) => t._id.toString());
    if (ids.length === 0) return NextResponse.json({});

    // One aggregation per request is fine — workouts collection scales
    // with user activity, not template count, so a $group over a
    // filtered match is cheap. Index on `templateId` exists implicitly
    // through the existing `userId` query patterns.
    const counts = await WorkoutModel.aggregate<{ _id: string; count: number }>([
      { $match: { templateId: { $in: ids } } },
      { $group: { _id: '$templateId', count: { $sum: 1 } } },
    ]);

    const result: Record<string, number> = {};
    for (const c of counts) result[c._id.toString()] = c.count;
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching template usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template usage' },
      { status: 500 }
    );
  }
}
