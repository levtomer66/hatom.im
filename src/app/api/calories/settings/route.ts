import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseSettings } from '@/lib/calories/calories';
import { getUser, setSettings } from '@/models/Calories';
import { bad, readJson, serverError } from '../_shared';

// GET — the caller's goals (null before the first visit's prompt).
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json({ settings: (await getUser(caller.userEmail)).settings });
  } catch (error) {
    return serverError('reading settings', error);
  }
}

// PUT { goal, proteinGoal } — daily kcal goal (500–10,000) and an optional protein goal (10–500 g).
export async function PUT(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const s = parseSettings(body);
  if (!s.ok) return bad(s.error);
  try {
    await setSettings(caller.userEmail, s.value);
    return NextResponse.json({ settings: s.value });
  } catch (error) {
    return serverError('saving settings', error);
  }
}
