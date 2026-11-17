import clientPromise from '@/lib/mongodb';
import { MAX_MY_ITEMS, addToList, homeFromLists, type ListLine, type MyItem, type ShoppingHome } from '@/lib/shopping/home';
import { getItemMeta } from '@/models/ShoppingCatalog';
import { getAllShoppingListsForMigration } from '@/models/ShoppingList';

// The household's My items and its one shopping list: a single document,
// shared by everyone holding `shopping`. Created on first read from the old
// named lists (`shoppingLists`, left untouched). Writes replace a whole array;
// trips pull bought keys with $pull so they don't race an edit.
const COLLECTION_NAME = 'shoppingHome';
const HOME_ID = 'home';

interface HomeDocument extends ShoppingHome {
  _id: string;
}

/** What the API returns: the doc plus each My item's department and photo. */
export type ShoppingHomeView = ShoppingHome & { meta: Awaited<ReturnType<typeof getItemMeta>> };

async function getCollection() {
  return (await clientPromise).db().collection<HomeDocument>(COLLECTION_NAME);
}

const plain = ({ items, list, updatedAt }: HomeDocument): ShoppingHome => ({ items, list, updatedAt });

export async function getHome(): Promise<ShoppingHome> {
  const col = await getCollection();
  const doc = await col.findOne({ _id: HOME_ID });
  if (doc) return plain(doc);
  const items = homeFromLists(await getAllShoppingListsForMigration());
  // Upsert with $setOnInsert: two first reads at once still make one doc.
  await col.updateOne(
    { _id: HOME_ID },
    { $setOnInsert: { items, list: [], updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
  return plain((await col.findOne({ _id: HOME_ID }))!);
}

export async function withMeta(home: ShoppingHome): Promise<ShoppingHomeView> {
  const keys = [...new Set([...home.items, ...home.list].map((i) => i.key))];
  return { ...home, meta: await getItemMeta(keys) };
}

async function set(fields: Partial<ShoppingHome>): Promise<ShoppingHome> {
  await getHome(); // migrate first if needed
  const doc = await (await getCollection()).findOneAndUpdate(
    { _id: HOME_ID },
    { $set: { ...fields, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  return plain(doc!);
}

export const setMyItems = (items: MyItem[]) => set({ items });
export const setList = (list: ListLine[]) => set({ list });
export const setHome = (fields: { items?: MyItem[]; list?: ListLine[] }) => set(fields);

export async function addLines(lines: ListLine[]): Promise<ShoppingHome> {
  const home = await getHome();
  return set({ list: addToList(home.list, lines) });
}

/** Lines not yet among My items are saved there too, their quantity as the usual one. */
export async function ensureMyItems(lines: ListLine[], by: string): Promise<void> {
  const home = await getHome();
  const have = new Set(home.items.map((i) => i.key));
  const now = new Date().toISOString();
  const add = lines.filter((l) => !have.has(l.key)).map((l) => ({ ...l, addedBy: by, addedAt: now }));
  if (!add.length) return;
  await set({ items: [...home.items, ...add].slice(0, MAX_MY_ITEMS) });
}

/** After a trip: pull what was ticked, unless it was also marked not there. */
export async function pullBought(ticked: string[], notThere: string[]): Promise<void> {
  const gone = ticked.filter((k) => !notThere.includes(k));
  if (!gone.length) return;
  await getHome();
  await (await getCollection()).updateOne(
    { _id: HOME_ID },
    { $pull: { list: { key: { $in: gone } } }, $set: { updatedAt: new Date().toISOString() } },
  );
}
