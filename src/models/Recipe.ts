import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { emptyRecipe, type RecipePatch } from '@/lib/recipes/recipe';
import { perServing } from '@/lib/recipes/nutrition';
import type { Recipe, RecipeSummary } from '@/lib/recipes/types';
import { getUserDisplayName } from '@/types/workout';

export { canRead } from '@/lib/recipes/recipe';

// Recipes (docs/superpowers/specs/2026-11-24-recipes-design.md § Data): one doc
// per recipe in `recipes`, owned by an email, optionally on the feed. Nutrition
// is derived from the lines on read, never stored.

type RecipeDocument = Omit<Recipe, 'id' | 'ownerName'> & { _id: ObjectId };

let indexed = false;
async function col() {
  const c = (await clientPromise).db().collection<RecipeDocument>('recipes');
  if (!indexed) {
    await Promise.all([
      c.createIndex({ owner: 1, updatedAt: -1 }),
      c.createIndex({ 'shared.at': -1 }, { partialFilterExpression: { shared: { $type: 'object' } } }),
    ]);
    indexed = true;
  }
  return c;
}

const oid = (id: string): ObjectId | null => (ObjectId.isValid(id) && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null);

const toRecipe = ({ _id, ...d }: RecipeDocument): Recipe => ({ ...d, id: _id.toHexString() });

function toSummary(r: Recipe, withOwner = false): RecipeSummary {
  const { totals, partial } = perServing(r);
  return {
    id: r.id, owner: r.owner, ...(withOwner ? { ownerName: getUserDisplayName(r.owner) } : {}),
    name: r.name, servings: r.servings, tags: r.tags, prepMin: r.prepMin, cookMin: r.cookMin, photo: r.photo,
    shared: r.shared, updatedAt: r.updatedAt, kcal: totals ? totals.kcal : null, partial,
    ingredientNames: r.ingredients.map((i) => i.name).filter(Boolean),
  };
}

const LIGHT = { steps: 0, notes: 0 } as const;

export async function listMine(email: string): Promise<RecipeSummary[]> {
  const docs = await (await col()).find({ owner: email }, { projection: LIGHT }).sort({ updatedAt: -1 }).limit(500).toArray();
  return docs.map((d) => toSummary(toRecipe({ ...d, steps: [], notes: '' })));
}

export async function listFeed(limit = 100): Promise<RecipeSummary[]> {
  const docs = await (await col()).find({ shared: { $type: 'object' } }, { projection: LIGHT }).sort({ 'shared.at': -1 }).limit(limit).toArray();
  return docs.map((d) => toSummary(toRecipe({ ...d, steps: [], notes: '' }), true));
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const _id = oid(id);
  if (!_id) return null;
  const d = await (await col()).findOne({ _id });
  return d ? { ...toRecipe(d), ownerName: getUserDisplayName(d.owner) } : null;
}

/** All of the caller's recipes (MCP list/search needs the lines). */
export async function listMineFull(email: string): Promise<Recipe[]> {
  return (await (await col()).find({ owner: email }).sort({ updatedAt: -1 }).limit(500).toArray()).map(toRecipe);
}

export type RecipeInit = RecipePatch & Partial<Pick<Recipe, 'photo' | 'source' | 'copiedFrom'>>;

export async function createRecipe(email: string, init: RecipeInit = {}): Promise<Recipe> {
  const now = new Date().toISOString();
  const { shared, ...rest } = init;
  const doc: RecipeDocument = {
    _id: new ObjectId(), owner: email, ...emptyRecipe(), ...rest,
    shared: shared ? { at: now } : null, createdAt: now, updatedAt: now,
  };
  await (await col()).insertOne(doc);
  return toRecipe(doc);
}

/** Sets only the patch's keys (two editors saving different fields never overwrite each other). */
export async function updateRecipe(email: string, id: string, patch: RecipeInit): Promise<Recipe | null> {
  const _id = oid(id);
  if (!_id) return null;
  const c = await col();
  const { shared, ...fields } = patch;
  const now = new Date().toISOString();
  const set: Record<string, unknown> = { ...fields, updatedAt: now };
  if (shared === false) set.shared = null;
  if (shared === true) {
    // Keep the original date when it's already on the feed.
    await c.updateOne({ _id, owner: email, shared: null }, { $set: { shared: { at: now } } });
  }
  const d = await c.findOneAndUpdate({ _id, owner: email }, { $set: set }, { returnDocument: 'after' });
  return d ? toRecipe(d) : null;
}

/** Replaces the photo; returns the previous one (to delete its blob), or undefined when not found. */
export async function setPhoto(email: string, id: string, url: string | null): Promise<string | null | undefined> {
  const _id = oid(id);
  if (!_id) return undefined;
  const d = await (await col()).findOneAndUpdate(
    { _id, owner: email }, { $set: { photo: url, updatedAt: new Date().toISOString() } }, { returnDocument: 'before' },
  );
  return d ? d.photo : undefined;
}

export async function deleteRecipe(email: string, id: string): Promise<Recipe | null> {
  const _id = oid(id);
  if (!_id) return null;
  const d = await (await col()).findOneAndDelete({ _id, owner: email });
  return d ? toRecipe(d) : null;
}
