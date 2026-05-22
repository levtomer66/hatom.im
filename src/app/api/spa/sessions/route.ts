import { NextRequest, NextResponse } from 'next/server';
import {
  CreateSpaSessionDto,
  coerceFlags,
  isValidSpaDuration,
  otherSpaUser,
  spaUserIdFromEmail,
} from '@/types/spa';
import { getAllSpaSessions, createSpaSession } from '@/models/SpaSession';
import { requireOwner } from '@/lib/auth-helpers';

// GET — spa session history. Visible to any signed-in owner. The model
// already returns sessions sorted newest-first.
export async function GET() {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;

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

// POST — schedule a session. Owners only. The receiver is the signed-in
// Tom; the giver is the OTHER Tom. Any client-supplied giverId is ignored.
export async function POST(request: NextRequest) {
  const gate = await requireOwner();
  if (gate instanceof NextResponse) return gate;

  const receiverId = spaUserIdFromEmail(gate.session.user.email);
  if (!receiverId) {
    // requireOwner already proves Tom/Tomer, so this is belt-and-braces.
    return NextResponse.json({ error: 'Not a spa user' }, { status: 403 });
  }
  const giverId = otherSpaUser(receiverId);

  try {
    const data = (await request.json()) as Partial<CreateSpaSessionDto>;

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

    const session = await createSpaSession({
      giverId,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      flags: coerceFlags(data.flags),
      preferences: data.preferences.slice(0, 2000),
      happyEnding: data.happyEnding === true,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating spa session:', error);
    return NextResponse.json(
      { error: 'Failed to create spa session' },
      { status: 500 }
    );
  }
}
