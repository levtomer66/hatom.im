import { NextRequest, NextResponse } from 'next/server';
import { withCaf } from '@/lib/pregnancy/drinks';
import { parseMeal } from '@/lib/calories/calories';
import { createMeal, listMeals } from '@/models/Calories';
import { bad, readJson, serverError, requireDiaryCaller } from '../_shared';

const MAX_MEALS = 100;

// GET — the caller's home-made meals. POST { name, portions, items } — a new one.
export async function GET(request: NextRequest) {
  const caller = await requireDiaryCaller(request);
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json({ meals: await listMeals(caller.userEmail) });
  } catch (error) {
    return serverError('listing meals', error);
  }
}

export async function POST(request: NextRequest) {
  const caller = await requireDiaryCaller(request);
  if (caller instanceof NextResponse) return caller;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const m = parseMeal(body);
  if (!m.ok) return bad(m.error);
  m.value.items = withCaf(m.value.items);
  try {
    if ((await listMeals(caller.userEmail)).length >= MAX_MEALS) return bad(`אפשר עד ${MAX_MEALS} ארוחות`);
    return NextResponse.json({ meal: await createMeal(caller.userEmail, m.value) }, { status: 201 });
  } catch (error) {
    return serverError('creating a meal', error);
  }
}
