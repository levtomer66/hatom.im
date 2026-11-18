import clientPromise from '@/lib/mongodb';
import type { ShoppingSettings } from '@/lib/shopping/api-types';
import { CITIES } from '@/lib/shopping/cities';

// Per-user /shopping preferences (the ⚙ menu), one doc per user keyed by
// session email, like workoutUserSettings. Typed functions, no ODM.
const COLLECTION_NAME = 'shoppingUserSettings';

interface ShoppingSettingsDocument extends Partial<ShoppingSettings> {
  _id: string;
  updatedAt?: string;
}

export const DEFAULT_SHOPPING_SETTINGS: ShoppingSettings = { nutritionHero: false, city: null };
const knownCity = (c: unknown): string | null => (typeof c === 'string' && CITIES.some((x) => x.id === c) ? c : null);

async function getCollection() {
  return (await clientPromise).db().collection<ShoppingSettingsDocument>(COLLECTION_NAME);
}

export async function getShoppingSettings(email: string): Promise<ShoppingSettings> {
  const doc = await (await getCollection()).findOne({ _id: email });
  return { nutritionHero: doc?.nutritionHero === true, city: knownCity(doc?.city) };
}

export async function updateShoppingSettings(email: string, patch: Partial<ShoppingSettings>): Promise<ShoppingSettings> {
  const set: Partial<ShoppingSettingsDocument> = { updatedAt: new Date().toISOString() };
  if (typeof patch.nutritionHero === 'boolean') set.nutritionHero = patch.nutritionHero;
  if (patch.city !== undefined) set.city = knownCity(patch.city);
  await (await getCollection()).updateOne({ _id: email }, { $set: set }, { upsert: true });
  return getShoppingSettings(email);
}
