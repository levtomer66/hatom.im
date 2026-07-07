import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import type { CoffeeOrder, OrderStatus } from '@/types/coffee-order';

const COLLECTION_NAME = 'coffeeOrders';

// `status` is optional on the document: orders written before the barista
// board existed have none. Readers normalize missing → 'open' in docToOrder.
interface CoffeeOrderDocument extends Omit<CoffeeOrder, 'id' | 'status'> {
  _id?: ObjectId;
  status?: OrderStatus;
}

export async function getCoffeeOrdersCollection() {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<CoffeeOrderDocument>(COLLECTION_NAME);
}

function docToOrder(doc: CoffeeOrderDocument): CoffeeOrder {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    status: rest.status ?? 'open',
    id: _id!.toString(),
  } as CoffeeOrder;
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
  data: Omit<CoffeeOrder, 'id' | 'createdAt' | 'status'>
): Promise<CoffeeOrder> {
  const collection = await getCoffeeOrdersCollection();
  const newDoc: Omit<CoffeeOrderDocument, '_id'> = {
    ...data,
    userEmail: data.userEmail.toLowerCase(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  const result = await collection.insertOne(newDoc);
  return { ...newDoc, id: result.insertedId.toString() } as CoffeeOrder;
}

// Every user's orders, newest first — the barista board's read. Capped so the
// board can't grow unbounded; 200 covers weeks of family coffee.
export async function getAllCoffeeOrders(limit = 200): Promise<CoffeeOrder[]> {
  const collection = await getCoffeeOrdersCollection();
  const docs = await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(docToOrder);
}

// Flip an order's status (barista board). Returns the updated order, or null
// when the id is unknown/malformed.
export async function setCoffeeOrderStatus(
  id: string,
  status: OrderStatus
): Promise<CoffeeOrder | null> {
  const collection = await getCoffeeOrdersCollection();
  try {
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status } },
      { returnDocument: 'after' }
    );
    return result ? docToOrder(result) : null;
  } catch (error) {
    console.error('Error updating coffee order status:', error);
    return null;
  }
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
