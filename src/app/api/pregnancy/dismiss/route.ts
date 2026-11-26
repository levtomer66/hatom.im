import { NextRequest, NextResponse } from 'next/server';
import { SUGGESTION_IDS, type SuggestionId } from '@/lib/pregnancy/schedule';
import { setDismissed } from '@/models/Pregnancy';
import { bad, readJson, requirePregnancyCaller, serverError, toViewer } from '../_shared';

// POST { sid, on } — "לא רלוונטי" on a suggested event (on: false brings it back).
export async function POST(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!gate.p) return bad('אין הריון פעיל', 404);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.sid !== 'string' || !SUGGESTION_IDS.has(b.sid)) return bad('הצעה לא מוכרת');
  try {
    return NextResponse.json({ p: toViewer(await setDismissed(gate.p.id, b.sid as SuggestionId, b.on !== false), gate.caller.userEmail) });
  } catch (error) {
    return serverError('dismissing a suggestion', error);
  }
}
