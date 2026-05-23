import { NextRequest, NextResponse } from 'next/server';
import {
  CreateSpaSessionDto,
  SpaSession,
  clampSpicyFlags,
  coerceFlags,
  flagsLabel,
  getSpaUser,
  isValidSpaDuration,
  otherSpaUser,
} from '@/types/spa';
import { getAllSpaSessions, createSpaSession } from '@/models/SpaSession';
import { requireSpaUser } from '@/lib/auth-helpers';

const NTFY_TOPIC = 'hatomim_spa';

// Fire-and-forget push notification to the public ntfy.sh topic so the
// other Tom gets pinged the moment a session lands. Same pattern as the
// workout HelpButton (hatomim_workout_help). Failure is logged but
// never blocks the API response.
function notifySpaSchedule(session: SpaSession): void {
  const giver = getSpaUser(session.giverId).name;
  const receiver = getSpaUser(session.receiverId).name;
  const flags = flagsLabel(session.flags);
  const bodyLines = [
    `${giver} → ${receiver}`,
    `When: ${session.scheduledAt}`,
    `Duration: ${session.durationMinutes} min`,
  ];
  if (flags && flags !== '—') bodyLines.push(`Flags: ${flags}`);
  if (session.preferences?.trim()) bodyLines.push(`Notes: ${session.preferences.trim()}`);

  fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    body: bodyLines.join('\n'),
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // `Title` and `Tags` must be ASCII for ntfy.sh.
      Title: `New spa session: ${giver} -> ${receiver}`,
      Tags: 'sparkles,rose',
    },
  }).catch((err) => {
    console.error('ntfy spa notify failed', err);
  });
}

// GET — spa session history. Visible to any signed-in SPA_USER (Tom or
// Tomer); the two are the only people who can be a giver/receiver, so
// they're also the only people who'd find the list meaningful.
export async function GET() {
  const gate = await requireSpaUser();
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

// POST — schedule a session. SPA_USERS only (independent of site-wide
// ownership). The receiver is the signed-in Tom; the giver is the OTHER
// Tom. Any client-supplied giverId is ignored.
export async function POST(request: NextRequest) {
  const gate = await requireSpaUser();
  if (gate instanceof NextResponse) return gate;

  const receiverId = gate.spaUserId;
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

    const happyEnding = data.happyEnding === true;
    const session = await createSpaSession({
      giverId,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      flags: clampSpicyFlags(coerceFlags(data.flags), happyEnding),
      preferences: data.preferences.slice(0, 2000),
      happyEnding,
    });
    notifySpaSchedule(session);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating spa session:', error);
    return NextResponse.json(
      { error: 'Failed to create spa session' },
      { status: 500 }
    );
  }
}
