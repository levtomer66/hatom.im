import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { isDate, MAX_ENTRIES, MEALS, parseEntry, type Entry, type Meal } from '@/lib/calories/calories';
import { recipeEntry } from '@/lib/recipes/calories-link';
import { perServing } from '@/lib/recipes/nutrition';
import { addEntry, addRecent } from '@/models/Calories';
import { canRead, getRecipe } from '@/models/Recipe';
import { bad, notFound, readJson, serverError } from '../../_shared';

type Ctx = { params: Promise<{ id: string }> };

// POST { date, meal, qty } — "רשום מנה": qty servings (0.5–20, by halves)
// onto the caller's calories diary. The entry's values are frozen; editing
// the recipe later never changes the day. Needs calories too.
export async function POST(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const eater = await requireFeatureCaller(request, 'calories');
  if (eater instanceof NextResponse) return eater;
  const { id } = await params;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const { date, meal, qty } = (body ?? {}) as { date?: unknown; meal?: unknown; qty?: unknown };
  if (!isDate(date)) return bad('תאריך לא תקין');
  if (!MEALS.includes(meal as Meal)) return bad('ארוחה לא מוכרת');
  if (typeof qty !== 'number' || qty < 0.5 || qty > 20 || Math.round(qty * 2) !== qty * 2) return bad('כמות לא תקינה');
  try {
    const r = await getRecipe(id);
    if (!r || !canRead(r, caller.userEmail)) return notFound();
    const draft = recipeEntry(r, qty);
    if (!draft) return bad('אין ערכים תזונתיים — קשרו מצרכים במתכון');
    const parsed = parseEntry({ ...draft, meal });
    if (!parsed.ok) return bad(parsed.error);
    const entry: Entry = { ...parsed.value, base: { qty: parsed.value.qty, nu: parsed.value.nu }, id: randomUUID(), at: new Date().toISOString() };
    if (!(await addEntry(caller.userEmail, date, entry))) return bad(`אפשר עד ${MAX_ENTRIES} רישומים ביום`);
    await addRecent(caller.userEmail, { ref: entry.ref, name: entry.name, img: entry.img, unit: entry.unit, qty: entry.qty, per100: null, per: perServing(r).totals! });
    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (error) {
    return serverError('logging a serving', error);
  }
}
