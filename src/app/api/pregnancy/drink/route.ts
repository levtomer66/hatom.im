import { NextRequest, NextResponse } from 'next/server';
import { defaultMeal, MEALS, type Meal } from '@/lib/calories/calories';
import { isDate, israelHour } from '@/lib/pregnancy/dates';
import { drinkById } from '@/lib/pregnancy/drinks';
import { bad, drinkEntry, FULL_DAY, isOwner, logEntry, readJson, requirePregnancyCaller, serverError } from '../_shared';

// POST { id, date, qty?, meal?, hour? } — the drinks row's one tap: logs a built-in
// drink into the owner's calories diary (the same entry /calories shows).
export async function POST(request: NextRequest) {
  const gate = await requirePregnancyCaller(request);
  if (gate instanceof NextResponse) return gate;
  if (!isOwner(gate.p, gate.caller.userEmail)) return bad('רק בעלת ההריון רושמת', 403);
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  const d = typeof b.id === 'string' ? drinkById(b.id) : null;
  if (!d) return bad('משקה לא מוכר');
  if (!isDate(b.date)) return bad('תאריך לא תקין');
  const qty = b.qty === undefined ? 1 : b.qty;
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0 || qty > 10) return bad('כמות בין 0 ל־10');
  const hour = typeof b.hour === 'number' && b.hour >= 0 && b.hour < 24 ? b.hour : israelHour(new Date());
  const meal = MEALS.includes(b.meal as Meal) ? (b.meal as Meal) : defaultMeal(hour);
  try {
    const entry = drinkEntry(d, qty, meal);
    if (!(await logEntry(gate.caller.userEmail, b.date, entry, d.nu))) return bad(FULL_DAY);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return serverError('logging a drink', error);
  }
}
