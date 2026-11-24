import { NextRequest, NextResponse } from 'next/server';
import { isDate, MAX_BURNED } from '@/lib/calories/calories';
import { setBurned } from '@/models/Calories';
import { bad, readJson, serverError, requireDiaryCaller } from '../_shared';

// PUT { date, workoutId, kcal } — corrects a workout's estimated burn on that day
// (kcal null goes back to the estimate). The workout itself is never written.
export async function PUT(request: NextRequest) {
  const caller = await requireDiaryCaller(request);
  if (caller instanceof NextResponse) return caller;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isDate(b.date)) return bad('תאריך לא תקין');
  if (typeof b.workoutId !== 'string' || !/^[a-f0-9]{24}$/.test(b.workoutId)) return bad('אימון לא מוכר');
  const kcal = b.kcal ?? null;
  if (kcal !== null && (typeof kcal !== 'number' || !Number.isInteger(kcal) || kcal < 0 || kcal > MAX_BURNED)) return bad(`בין 0 ל־${MAX_BURNED.toLocaleString('he-IL')} קק״ל`);
  try {
    await setBurned(caller.userEmail, b.date, b.workoutId, kcal);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('saving a workout burn', error);
  }
}
