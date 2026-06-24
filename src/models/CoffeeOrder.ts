import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { CoffeeOrder } from '@/types/coffee-order';

const COLLECTION_NAME = 'coffeeOrders';

interface CoffeeOrderDocument extends Omit<CoffeeOrder, 'id'> {
  _id?: ObjectId;
}

export async function getCoffeeOrdersCollection() {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<CoffeeOrderDocument>(COLLECTION_NAME);
}

function docToOrder(doc: CoffeeOrderDocument): CoffeeOrder {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id!.toString() } as CoffeeOrder;
}

// One user's orders, newest first.
export async function getCoffeeOrdersForUser(
  userEmail: string
): Promise<CoffeeOrder[]> {
  const collection = await getCoffeeOrdersCollection();
  const docs = await collection
    .find({ userEmail: userEmail.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(docToOrder);
}

export async function createCoffeeOrder(
  data: Omit<CoffeeOrder, 'id' | 'createdAt'>
): Promise<CoffeeOrder> {
  const collection = await getCoffeeOrdersCollection();
  const newDoc: Omit<CoffeeOrderDocument, '_id'> = {
    ...data,
    userEmail: data.userEmail.toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  const result = await collection.insertOne(newDoc);
  return { ...newDoc, id: result.insertedId.toString() } as CoffeeOrder;
}

// Delete one order. A non-owner may only delete their own (the userEmail
// filter scopes it); owners may delete any. Returns true when a doc was removed.
export async function deleteCoffeeOrder(
  id: string,
  userEmail: string,
  isOwner: boolean
): Promise<boolean> {
  const collection = await getCoffeeOrdersCollection();
  try {
    const filter: Record<string, unknown> = { _id: new ObjectId(id) };
    if (!isOwner) filter.userEmail = userEmail.toLowerCase();
    const result = await collection.deleteOne(filter);
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting coffee order:', error);
    return false;
  }
}
