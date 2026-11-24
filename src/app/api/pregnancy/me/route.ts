import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dayCaf } from '@/lib/calories/calories';
import { dayOfPregnancy, isDate } from '@/lib/pregnancy/dates';
import type { MeResponse } from '@/lib/pregnancy/pregnancy';
import { getDays } from '@/models/Calories';
import { activePregnantOwner } from '@/lib/pregnancy-diary';
import { gainFor, serverError } from '../_shared';

// GET ?today= — what other apps show a pregnant owner (the weight-gain tile on
// /calories and /workout, the "אחרי הקפה" line on /coffee-order). null for
// anyone else; never a 403 for a signed-in user, so callers needn't check first.
export async function GET(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const today = request.nextUrl.searchParams.get('today');
  if (!isDate(today)) return NextResponse.json(null);
  try {
    const p = await activePregnantOwner(email);
    if (!p) return NextResponse.json(null);
    const [gain, days] = await Promise.all([gainFor(p, today), getDays(email, [today])]);
    const res: MeResponse = { gain, cafToday: dayCaf(days[today] ?? []), limit: p.cafLimit, day: dayOfPregnancy(p.edd, today) };
    return NextResponse.json(res);
  } catch (error) {
    return serverError('reading /me', error);
  }
}
