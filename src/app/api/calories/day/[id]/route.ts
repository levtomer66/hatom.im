import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { isDate, MAX_GRAMS, MEALS, type Meal } from '@/lib/calories/calories';
import { deleteEntry, updateEntry } from '@/models/Calories';
import { bad, readJson, serverError } from '../../_shared';

type Ctx = { params: Promise<{ id: string }> };

// PATCH { date, meal?, qty? } — moves an entry or changes its amount; the
// frozen totals scale with the quantity (never re-read from the catalog).
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isDate(b.date)) return bad('תאריך לא תקין');
  if (b.meal !== undefined && !MEALS.includes(b.meal as Meal)) return bad('ארוחה לא מוכרת');
  if (b.qty !== undefined && (typeof b.qty !== 'number' || !Number.isFinite(b.qty) || b.qty <= 0 || b.qty > MAX_GRAMS)) return bad('כמות לא תקינה');
  try {
    const entry = await updateEntry(caller.userEmail, b.date, id, { meal: b.meal as Meal | undefined, qty: b.qty as number | undefined });
    if (!entry) return bad('הרישום לא נמצא', 404);
    if (entry === 'too-big') return bad(`עד ${MAX_GRAMS.toLocaleString('he-IL')} גרם ברישום אחד`);
    return NextResponse.json({ entry });
  } catch (error) {
    return serverError('updating an entry', error);
  }
}

// DELETE ?date= — removes an entry.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'calories');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const date = request.nextUrl.searchParams.get('date');
  if (!isDate(date)) return bad('תאריך לא תקין');
  try {
    if (!(await deleteEntry(caller.userEmail, date, id))) return bad('הרישום לא נמצא', 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('deleting an entry', error);
  }
}
