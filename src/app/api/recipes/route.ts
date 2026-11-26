import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureCaller } from '@/lib/api-caller';
import { parseRecipePatch } from '@/lib/recipes/recipe';
import { createRecipe, listMine } from '@/models/Recipe';
import { bad, serverError } from './_shared';

// GET — the caller's recipes (cards: no steps or notes).
export async function GET(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  try {
    return NextResponse.json({ recipes: await listMine(caller.userEmail) });
  } catch (error) {
    return serverError('listing recipes', error);
  }
}

// POST { …fields? } — a new recipe of the caller's (empty unless fields are sent).
export async function POST(request: NextRequest) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const text = await request.text();
  let body: unknown = {};
  try {
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return bad('Invalid JSON');
  }
  const patch = parseRecipePatch(body);
  if (!patch.ok) return bad(patch.error);
  try {
    return NextResponse.json({ recipe: await createRecipe(caller.userEmail, patch.value) }, { status: 201 });
  } catch (error) {
    return serverError('creating a recipe', error);
  }
}
