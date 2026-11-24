import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { isDate, kgOk } from '@/lib/calories/calories';
import { addWeighIn } from '@/models/Calories';
import { setBodyweight } from '@/models/WorkoutUserSettings';
import { bad, readJson, serverError } from '../_shared';

// PUT { date, kg } — the body weight, shared with the workout app (its
// workoutUserSettings.bodyweightKg is the one current value), plus that day's weigh-in.
export async function PUT(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isDate(b.date)) return bad('תאריך לא תקין');
  if (!kgOk(b.kg)) return bad('משקל בין 25 ל־400 ק״ג');
  const kg = Math.round(b.kg * 10) / 10;
  try {
    await setBodyweight(caller.userEmail, kg);
    const log = await addWeighIn(caller.userEmail, { d: b.date, kg });
    return NextResponse.json({ kg, log });
  } catch (error) {
    return serverError('saving the weight', error);
  }
}
