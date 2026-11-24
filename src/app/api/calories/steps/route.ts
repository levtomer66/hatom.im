import { NextRequest, NextResponse } from 'next/server';
import { isDate, MAX_STEPS, stepsOk } from '@/lib/calories/calories';
import { setSteps } from '@/models/Calories';
import { bad, readJson, serverError, requireDiaryCaller } from '../_shared';

// PUT { date, steps } — the day's steps, typed by hand (null clears them). Their
// burn is worked out on each read (stepsBurn), from the weight and the profile.
export async function PUT(request: NextRequest) {
  const caller = await requireDiaryCaller(request);
  if (caller instanceof NextResponse) return caller;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isDate(b.date)) return bad('תאריך לא תקין');
  const steps = b.steps ?? null;
  if (steps !== null && !stepsOk(steps)) return bad(`בין 0 ל־${MAX_STEPS.toLocaleString('he-IL')} צעדים`);
  try {
    await setSteps(caller.userEmail, b.date, steps);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('saving steps', error);
  }
}
