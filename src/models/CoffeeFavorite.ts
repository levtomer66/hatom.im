import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { CoffeeFavorite } from '@/types/coffee-order';

const COLLECTION_NAME = 'coffeeFavorites';

interface CoffeeFavoriteDocument extends Omit<CoffeeFavorite, 'id'> {
  _id?: ObjectId;
}

export async function getCoffeeFavoritesCollection() {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<CoffeeFavoriteDocument>(COLLECTION_NAME);
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
