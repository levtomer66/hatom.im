import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { MAX_LIST_ITEMS, normalizeQty } from '@/lib/shopping/home';
import { getItems } from '@/models/ShoppingCatalog';
import { addLines, householdFor } from '@/models/ShoppingHome';
import { canRead, getRecipe, setLineKeys, type Recipe } from '@/models/Recipe';
import { bad, notFound, readJson, serverError } from '../../_shared';

type Ctx = { params: Promise<{ id: string }> };
const KEY = /^[\w:.-]{1,60}$/;

// POST { lines: [{key, qty}], picks?: [{id, key}] } — the ticked products onto
// the caller's household list (the list only, not My items). `picks` are
// products chosen in the sheet, remembered on the owner's lines.
export async function POST(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const shopper = await requireFeatureCaller(request, 'shopping');
  if (shopper instanceof NextResponse) return shopper;
  const { id } = await params;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const { lines, picks } = (body ?? {}) as { lines?: unknown; picks?: unknown };
  if (!Array.isArray(lines) || !lines.length || lines.length > MAX_LIST_ITEMS) return bad('לא נבחרו מוצרים');
  const wanted = new Map<string, number>();
  for (const l of lines as { key?: unknown; qty?: unknown }[]) {
    if (typeof l?.key !== 'string' || !KEY.test(l.key) || typeof l.qty !== 'number') return bad('מוצר לא תקין');
    wanted.set(l.key, (wanted.get(l.key) ?? 0) + l.qty);
  }
  try {
    const r = await getRecipe(id);
    if (!r || !canRead(r, caller.userEmail)) return notFound();
    const docs = await getItems([...wanted.keys()]);
    const add = docs.flatMap((d) => {
      const qty = normalizeQty(wanted.get(d._id)!, d.w);
      return qty === null ? [] : [{ key: d._id, name: d.n, qty, w: d.w }];
    });
    if (!add.length) return bad('המוצרים לא נמצאו', 404);
    const home = await householdFor(caller.userEmail);
    await addLines(home.id, add);
    let recipe: Recipe | null = null;
    if (r.owner === caller.userEmail && Array.isArray(picks) && picks.length) {
      const lineIds = new Set(r.ingredients.map((i) => i.id));
      const chosen = (picks as { id?: unknown; key?: unknown }[])
        .filter((p): p is { id: string; key: string } => typeof p?.id === 'string' && lineIds.has(p.id) && typeof p.key === 'string' && KEY.test(p.key));
      if (chosen.length) recipe = await setLineKeys(caller.userEmail, id, chosen);
    }
    return NextResponse.json({ added: add.length, ...(recipe ? { recipe } : {}) });
  } catch (error) {
    return serverError('adding to the list', error);
  }
}
