import clientPromise from '@/lib/mongodb';
import type { ListLine } from '@/lib/shopping/home';

// The old named lists (`shoppingLists`). Nothing reads or writes them any
// more except the one-time move into My items (src/models/ShoppingHome.ts);
// the data is left as it was, so the change can be rolled back.
const COLLECTION_NAME = 'shoppingLists';

interface ShoppingListDocument {
  items?: ListLine[];
  createdBy: string;
  updatedAt: string;
}

/** Every old named list, for the one-time move to My items. */
export async function getAllShoppingListsForMigration(): Promise<{ items: ListLine[]; createdBy: string; updatedAt: string }[]> {
  const docs = await (await clientPromise).db().collection<ShoppingListDocument>(COLLECTION_NAME)
    .find({}, { projection: { items: 1, createdBy: 1, updatedAt: 1 } }).toArray();
  return docs.map((d) => ({ items: d.items ?? [], createdBy: d.createdBy, updatedAt: d.updatedAt }));
}
