import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseRecipePatch } from '@/lib/recipes/recipe';
import { canRead, deleteRecipe, getRecipe, updateRecipe } from '@/models/Recipe';
import { bad, dropBlob, notFound, readJson, serverError } from '../_shared';

type Ctx = { params: Promise<{ id: string }> };

// GET — the caller's recipe, or anyone's while it's on the feed.
export async function GET(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  try {
    const r = await getRecipe(id);
    return r && canRead(r, caller.userEmail) ? NextResponse.json({ recipe: r }) : notFound();
  } catch (error) {
    return serverError('reading a recipe', error);
  }
}

// PATCH { …some fields, shared? } — the owner's edit; sets only the fields sent.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const patch = parseRecipePatch(body);
  if (!patch.ok) return bad(patch.error);
  try {
    const r = await updateRecipe(caller.userEmail, id, patch.value);
    return r ? NextResponse.json({ recipe: r }) : notFound();
  } catch (error) {
    return serverError('updating a recipe', error);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  try {
    const r = await deleteRecipe(caller.userEmail, id);
    if (!r) return notFound();
    await dropBlob(r.photo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('deleting a recipe', error);
  }
}
