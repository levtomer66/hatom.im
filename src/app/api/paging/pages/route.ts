import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import {
  PagerDutyConfigurationError,
  PagerDutyUpstreamError,
  createPageIncident,
} from '@/lib/pagerduty';
import { parsePageRequest } from '@/types/paging';

export async function POST(request: NextRequest) {
  // Browser session OR a personal API key (Shortcut / macOS app / MCP). The
  // key owner must currently hold the `paging` permission.
  const caller = await requireFeatureCaller(request, 'paging');
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
      callerEmail: caller.userEmail,
      source: caller.authMode === 'api-key' ? 'shortcut' : 'web',
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
