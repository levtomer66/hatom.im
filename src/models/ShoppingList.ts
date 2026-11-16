import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { ShoppingList, ShoppingListPatch } from '@/lib/shopping/lists';

// Lists are shared by everyone holding `shopping` (a household list);
// `createdBy` is informational, like calendar events.
const COLLECTION_NAME = 'shoppingLists';

interface ShoppingListDocument extends Omit<ShoppingList, 'id'> {
  _id?: ObjectId;
}

async function getCollection() {
  return (await clientPromise).db().collection<ShoppingListDocument>(COLLECTION_NAME);
}

function docToList(doc: ShoppingListDocument): ShoppingList {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toString() };
}

export async function getShoppingLists(): Promise<ShoppingList[]> {
  const docs = await (await getCollection()).find({}).sort({ updatedAt: -1 }).toArray();
  return docs.map(docToList);
}

export async function createShoppingList(name: string, createdBy: string): Promise<ShoppingList> {
  const now = new Date().toISOString();
  const doc: Omit<ShoppingListDocument, '_id'> = { name, items: [], createdBy, createdAt: now, updatedAt: now };
  const result = await (await getCollection()).insertOne(doc);
  return { ...doc, id: result.insertedId.toString() };
}

export async function updateShoppingList(id: string, patch: ShoppingListPatch): Promise<ShoppingList | null> {
  const doc = await (await getCollection()).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  return doc ? docToList(doc) : null;
}

export async function deleteShoppingList(id: string): Promise<boolean> {
  const result = await (await getCollection()).deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
