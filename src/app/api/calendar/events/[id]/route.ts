import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseEventInput } from '@/lib/calendar';
import { deleteCalendarEvent, updateCalendarEvent } from '@/models/CalendarEvent';

type Params = { params: Promise<{ id: string }> };

// PUT — full replace of an event's editable fields: send the whole event;
// an emoji or note left out is cleared.
export async function PUT(request: NextRequest, { params }: Params) {
  const caller = await requireFeatureCaller(request, 'calendar');
  if (caller instanceof NextResponse) return caller;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = parseEventInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const event = await updateCalendarEvent(id, parsed.value);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json(event);
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return NextResponse.json({ error: 'Failed to update calendar event' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const caller = await requireFeatureCaller(request, 'calendar');
  if (caller instanceof NextResponse) return caller;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  try {
    const removed = await deleteCalendarEvent(id);
    if (!removed) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return NextResponse.json({ error: 'Failed to delete calendar event' }, { status: 500 });
  }
}
