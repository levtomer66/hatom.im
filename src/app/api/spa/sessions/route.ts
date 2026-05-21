import { NextRequest, NextResponse } from 'next/server';
import {
  CreateSpaSessionDto,
  isValidSpaUserId,
  isValidMassageType,
  isValidSpaDuration,
} from '@/types/spa';
import { getAllSpaSessions, createSpaSession } from '@/models/SpaSession';

export async function GET() {
  try {
    const sessions = await getAllSpaSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching spa sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spa sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as Partial<CreateSpaSessionDto>;

    if (!isValidSpaUserId(data.giverId)) {
      return NextResponse.json({ error: 'Invalid giverId' }, { status: 400 });
    }
    if (!isValidMassageType(data.massageType)) {
      return NextResponse.json(
        { error: 'Invalid massageType' },
        { status: 400 }
      );
    }
    if (!isValidSpaDuration(data.durationMinutes)) {
      return NextResponse.json(
        { error: 'durationMinutes must be 30, 60, or 90' },
        { status: 400 }
      );
    }
    if (typeof data.scheduledAt !== 'string' || !data.scheduledAt.trim()) {
      return NextResponse.json(
        { error: 'scheduledAt is required' },
        { status: 400 }
      );
    }
    const parsed = new Date(data.scheduledAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: 'scheduledAt is not a valid date' },
        { status: 400 }
      );
    }
    if (typeof data.preferences !== 'string') {
      return NextResponse.json(
        { error: 'preferences must be a string' },
        { status: 400 }
      );
    }

    const dto: CreateSpaSessionDto = {
      giverId: data.giverId,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      massageType: data.massageType,
      preferences: data.preferences.slice(0, 2000),
      happyEnding: data.happyEnding === true,
    };

    const session = await createSpaSession(dto);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating spa session:', error);
    return NextResponse.json(
      { error: 'Failed to create spa session' },
      { status: 500 }
    );
  }
}
