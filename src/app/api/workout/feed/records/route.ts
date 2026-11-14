import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutModel from '@/models/Workout';
import { requireSignedIn } from '@/lib/auth-helpers';
import { getUserDisplayName, Workout } from '@/types/workout';
import { getBestPostPerUser } from '@/models/WorkoutFeedPost';
import { computeWorkoutStats } from '@/lib/workout-stats';
import {
  bestRow,
  computeVolumeRecords,
  VolumeRecordRow,
  VolumeRecordsResponse,
} from '@/lib/workout-records';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

// The caller's heaviest COMPLETED workout, shared or not, using the same
// load-aware volume math as the completion summary and the feed snapshot.
// Projects only what computeWorkoutStats reads.
async function getMyBest(userId: string): Promise<VolumeRecordRow | null> {
  await connectDB();
  const docs = await WorkoutModel.find(
    { userId, isCompleted: true },
    { date: 1, bodyweightKg: 1, 'exercises.sets': 1, 'exercises.load': 1 },
  ).lean();
  return bestRow(
    docs.map((d) => ({
      userId,
      workoutId: String(d._id),
      workoutDate: d.date,
      kg: computeWorkoutStats(d as unknown as Pick<Workout, 'exercises' | 'bodyweightKg'>).totalVolumeKg,
    })),
  );
}

// GET /api/workout/feed/records
// Volume records: each user's heaviest SHARED workout + the group record
// holder (feed banner, post badges, live workout bar), plus `myBest` — the
// caller's own heaviest completed workout, shared or not (live workout bar).
// Any signed-in user sees the shared records, same visibility as the feed.
export async function GET() {
  const gate = await requireSignedIn();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.session.user.email;

  try {
    const [rows, myBest] = await Promise.all([getBestPostPerUser(), getMyBest(userId)]);
    const body: VolumeRecordsResponse = { ...computeVolumeRecords(rows, getUserDisplayName), myBest };
    return NextResponse.json(body);
  } catch (error) {
    console.error('Error computing volume records:', error);
    return NextResponse.json({ error: 'Failed to load records' }, { status: 500 });
  }
}
