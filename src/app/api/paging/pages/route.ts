import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requirePagingCaller } from '@/lib/paging-auth';
import {
  PagerDutyConfigurationError,
  PagerDutyUpstreamError,
  createPageIncident,
} from '@/lib/pagerduty';
import { parsePageRequest } from '@/types/paging';

export async function POST(request: NextRequest) {
  const caller = await requirePagingCaller(request);
  if (caller instanceof NextResponse) return caller;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const page = parsePageRequest(body);
  if (!page) {
    return NextResponse.json(
      { error: 'Use one emoji and a message of at most 280 characters' },
      { status: 400 }
    );
  }

  try {
    const result = await createPageIncident({
      ...page,
      pageId: randomUUID(),
      callerEmail: caller.email,
      source: caller.source,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PagerDutyConfigurationError) {
      console.error('[paging] PagerDuty is not configured');
      return NextResponse.json({ error: 'Paging is not configured' }, { status: 503 });
    }
    if (error instanceof PagerDutyUpstreamError) {
      console.error('[paging] PagerDuty create failed', error.status);
      return NextResponse.json({ error: 'PagerDuty rejected the page' }, { status: 502 });
    }
    console.error('[paging] Unexpected create failure');
    return NextResponse.json({ error: 'Failed to send page' }, { status: 500 });
  }
}
