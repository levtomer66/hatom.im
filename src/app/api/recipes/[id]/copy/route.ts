import { NextRequest, NextResponse } from 'next/server';
import { copy } from '@vercel/blob';
import { requireFeatureCaller } from '@/lib/api-caller';
import { canRead, createRecipe, getRecipe } from '@/models/Recipe';
import { notFound, serverError } from '../../_shared';

type Ctx = { params: Promise<{ id: string }> };

// POST — "שמור אצלי": a feed recipe (or one's own) becomes a new, unshared
// recipe of the caller's. Its photo is copied to a blob of its own, so
// deleting the original never breaks the copy.
export async function POST(request: NextRequest, { params }: Ctx) {
  const caller = await requireFeatureCaller(request, 'recipes');
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  try {
    const r = await getRecipe(id);
    if (!r || !canRead(r, caller.userEmail)) return notFound();
    let photo: string | null = null;
    if (r.photo) {
      try {
        const name = `recipes/copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        photo = (await copy(r.photo, name, { access: 'public', contentType: 'image/jpeg' })).url;
      } catch (error) {
        console.error('recipes: copying a photo:', error);
      }
    }
    const mine = await createRecipe(caller.userEmail, {
      name: r.name, servings: r.servings, ingredients: r.ingredients, steps: r.steps, tags: r.tags,
      prepMin: r.prepMin, cookMin: r.cookMin, notes: r.notes, source: r.source, photo,
      copiedFrom: { id: r.id, owner: r.owner },
    });
    return NextResponse.json({ recipe: mine }, { status: 201 });
  } catch (error) {
    return serverError('copying a recipe', error);
  }
}
