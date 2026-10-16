import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseEventInput } from '@/lib/calendar';
import { createCalendarEvent, getCalendarEvents } from '@/models/CalendarEvent';

// GET — every calendar event. Anyone holding `calendar` can read and edit;
// the calendar is shared, there is no per-event owner.
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calendar');
  if (caller instanceof NextResponse) return caller;

  try {
    return NextResponse.json(await getCalendarEvents());
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calendar');
  if (caller instanceof NextResponse) return caller;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = parseEventInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const event = await createCalendarEvent(parsed.value, caller.userEmail);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
  }
}
