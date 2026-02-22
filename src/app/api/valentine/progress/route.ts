import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import ValentineProgressModel from '@/models/ValentineProgress';
import { PositionId } from '@/types/valentine';

const COUPLE_ID = 'default';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// GET /api/valentine/progress - get experienced position ids
export async function GET() {
  try {
    await connectDB();
    const doc = await ValentineProgressModel.findOne({ coupleId: COUPLE_ID }).lean();
    if (doc) {
      return NextResponse.json({
        coupleId: doc.coupleId,
        experiencedPositionIds: doc.experiencedPositionIds ?? [],
      });
    }
    const created = await ValentineProgressModel.create({
      coupleId: COUPLE_ID,
      experiencedPositionIds: [],
    });
    return NextResponse.json({
      coupleId: created.coupleId,
      experiencedPositionIds: created.experiencedPositionIds ?? [],
    });
  } catch (error) {
    console.error('Error fetching valentine progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

// POST /api/valentine/progress - add a position to experienced (idempotent)
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { positionId } = body as { positionId: PositionId };
    if (!positionId || typeof positionId !== 'string') {
      return NextResponse.json(
        { error: 'positionId is required' },
        { status: 400 }
      );
    }
    const doc = await ValentineProgressModel.findOneAndUpdate(
      { coupleId: COUPLE_ID },
      { $addToSet: { experiencedPositionIds: positionId } },
      { new: true, upsert: true }
    ).lean();
    return NextResponse.json({
      coupleId: doc!.coupleId,
      experiencedPositionIds: doc!.experiencedPositionIds ?? [],
    });
  } catch (error) {
    console.error('Error updating valentine progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}

// PATCH /api/valentine/progress - remove a position from experienced (uncheck)
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { positionId } = body as { positionId: PositionId };
    if (!positionId || typeof positionId !== 'string') {
      return NextResponse.json(
        { error: 'positionId is required' },
        { status: 400 }
      );
    }
    const doc = await ValentineProgressModel.findOneAndUpdate(
      { coupleId: COUPLE_ID },
      { $pull: { experiencedPositionIds: positionId } },
      { new: true }
    ).lean();
    if (!doc) {
      return NextResponse.json(
        { coupleId: COUPLE_ID, experiencedPositionIds: [] }
      );
    }
    return NextResponse.json({
      coupleId: doc.coupleId,
      experiencedPositionIds: doc.experiencedPositionIds ?? [],
    });
  } catch (error) {
    console.error('Error updating valentine progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}
