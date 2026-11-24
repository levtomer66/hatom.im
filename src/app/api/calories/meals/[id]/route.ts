import { NextRequest, NextResponse } from 'next/server';
import { withCaf } from '@/lib/pregnancy/drinks';
import { parseMeal } from '@/lib/calories/calories';
import { deleteMeal, updateMeal } from '@/models/Calories';
import { bad, readJson, serverError, requireDiaryCaller } from '../../_shared';

type Ctx = { params: Promise<{ id: string }> };

// PATCH { name, portions, items } — replaces the caller's meal. Past entries keep their frozen values.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const caller = await requireDiaryCaller(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const m = parseMeal(body);
  if (!m.ok) return bad(m.error);
  m.value.items = withCaf(m.value.items);
  try {
    const meal = await updateMeal(caller.userEmail, id, m.value);
    return meal ? NextResponse.json({ meal }) : bad('הארוחה לא נמצאה', 404);
  } catch (error) {
    return serverError('updating a meal', error);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const caller = await requireDiaryCaller(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  try {
    return (await deleteMeal(caller.userEmail, id)) ? NextResponse.json({ ok: true }) : bad('הארוחה לא נמצאה', 404);
  } catch (error) {
    return serverError('deleting a meal', error);
  }
}
