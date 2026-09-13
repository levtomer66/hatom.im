import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { CoffeeFavorite } from '@/types/coffee-order';

const COLLECTION_NAME = 'coffeeFavorites';

interface CoffeeFavoriteDocument extends Omit<CoffeeFavorite, 'id'> {
  _id?: ObjectId;
}

// getCoffeeFavoritesForUser filters by userEmail. Memoized so createIndex runs
// once per process, not on every collection access.
let indexesEnsured: Promise<void> | null = null;

export async function getCoffeeFavoritesCollection() {
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection<CoffeeFavoriteDocument>(COLLECTION_NAME);
  if (!indexesEnsured) {
    indexesEnsured = col
      .createIndex({ userEmail: 1 })
      .then(() => undefined)
      .catch((e) => {
        indexesEnsured = null; // allow a later retry
        throw e;
      });
  }
  await indexesEnsured;
  return col;
}

function docToFavorite(doc: CoffeeFavoriteDocument): CoffeeFavorite {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toString() } as CoffeeFavorite;
}

export async function getCoffeeFavoritesForUser(
  userEmail: string
): Promise<CoffeeFavorite[]> {
  const collection = await getCoffeeFavoritesCollection();
  const docs = await collection
    .find({ userEmail: userEmail.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(docToFavorite);
}

// Single favorite by id. Returns null for a missing doc or a malformed id
// (a bad ObjectId must 404, not 500). Ownership is enforced by the caller.
export async function getCoffeeFavoriteById(
  id: string
): Promise<CoffeeFavorite | null> {
  const collection = await getCoffeeFavoritesCollection();
  try {
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    return doc ? docToFavorite(doc) : null;
  } catch {
    return null;
  }
}

// A favorite by id, but only if it belongs to this user. Used to validate a
// default-favorite selection and to authorize key-mode coffee orders.
export async function getCoffeeFavoriteForUser(
  id: string,
  userEmail: string
): Promise<CoffeeFavorite | null> {
  const fav = await getCoffeeFavoriteById(id);
  if (!fav || fav.userEmail !== userEmail.toLowerCase()) return null;
  return fav;
}

export async function createCoffeeFavorite(
  data: Omit<CoffeeFavorite, 'id' | 'createdAt'>
): Promise<CoffeeFavorite> {
  const collection = await getCoffeeFavoritesCollection();
  const newDoc: Omit<CoffeeFavoriteDocument, '_id'> = {
    ...data,
    userEmail: data.userEmail.toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  const result = await collection.insertOne(newDoc);
  return { ...newDoc, id: result.insertedId.toString() } as CoffeeFavorite;
}

export async function deleteCoffeeFavorite(
  id: string,
  userEmail: string,
  isOwner: boolean
): Promise<boolean> {
  const collection = await getCoffeeFavoritesCollection();
  try {
    const filter: Record<string, unknown> = { _id: new ObjectId(id) };
    if (!isOwner) filter.userEmail = userEmail.toLowerCase();
    const result = await collection.deleteOne(filter);
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting coffee favorite:', error);
    return false;
  }
}
