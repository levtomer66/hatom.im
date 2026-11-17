import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { isShared, type ShoppingList, type ShoppingListPatch } from '@/lib/shopping/lists';

// A list is shared by everyone holding `shopping` (a household list) or
// personal to its creator (`shared: false`). Lists saved before `shared`
// existed have no field and count as shared. Every read and write here takes
// the caller's email and only reaches lists the caller may see, so a
// personal list is invisible, not just read-only, to anyone else.
const COLLECTION_NAME = 'shoppingLists';

interface ShoppingListDocument extends Omit<ShoppingList, 'id' | 'shared' | 'mine'> {
  _id?: ObjectId;
  shared?: boolean;
}

async function getCollection() {
  return (await clientPromise).db().collection<ShoppingListDocument>(COLLECTION_NAME);
}

/** Lists the caller may see: shared ones (or old ones without the field) and their own personal ones. */
const visibleTo = (email: string) => ({ $or: [{ shared: { $ne: false } }, { createdBy: email }] });

function docToList(doc: ShoppingListDocument, email: string): ShoppingList {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toString(), shared: isShared(doc), mine: doc.createdBy === email };
}

export async function getShoppingLists(email: string): Promise<ShoppingList[]> {
  const docs = await (await getCollection()).find(visibleTo(email)).sort({ updatedAt: -1 }).toArray();
  return docs.map((d) => docToList(d, email));
}

export async function getShoppingList(id: string, email: string): Promise<ShoppingList | null> {
  const doc = await (await getCollection()).findOne({ _id: new ObjectId(id), ...visibleTo(email) });
  return doc ? docToList(doc, email) : null;
}

export async function createShoppingList(name: string, shared: boolean, createdBy: string): Promise<ShoppingList> {
  const now = new Date().toISOString();
  const doc: Omit<ShoppingListDocument, '_id'> = { name, items: [], shared, createdBy, createdAt: now, updatedAt: now };
  const result = await (await getCollection()).insertOne(doc);
  return docToList({ ...doc, _id: result.insertedId }, createdBy);
}

/** Null when the list is missing or the caller can't see it. The route checks who may change `shared`. */
export async function updateShoppingList(id: string, patch: ShoppingListPatch, email: string): Promise<ShoppingList | null> {
  const doc = await (await getCollection()).findOneAndUpdate(
    { _id: new ObjectId(id), ...visibleTo(email) },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  return doc ? docToList(doc, email) : null;
}

export async function deleteShoppingList(id: string, email: string): Promise<boolean> {
  const result = await (await getCollection()).deleteOne({ _id: new ObjectId(id), ...visibleTo(email) });
  return result.deletedCount === 1;
}
