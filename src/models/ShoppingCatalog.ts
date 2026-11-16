import clientPromise from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/shopping/collections';
import type { ItemDoc, PromoDoc, StoreDoc } from '@/lib/shopping/snapshot';

// Read side of the price data the local ingest job writes
// (src/lib/shopping/ingest/cli.ts). The app never writes these collections.

async function getDb() {
  return (await clientPromise).db();
}

/** Stores with prices that serve `city`: its physical stores plus every online store. */
export async function getStoresFor(city: string): Promise<StoreDoc[]> {
  return (await getDb())
    .collection<StoreDoc>(COLLECTIONS.stores)
    .find({ pricesAt: { $ne: null }, $or: [{ city, kind: 'physical' }, { kind: 'online' }] })
    .toArray();
}

const SEARCH_SCAN = 300;

/** Items whose name contains every term (or whose key is `barcode`), unsorted. */
export async function findItems(terms: string[], barcode: string | null): Promise<ItemDoc[]> {
  const filter = barcode
    ? { _id: barcode }
    : { $and: terms.map((t) => ({ n: { $regex: t, $options: 'i' } })) };
  return (await getDb()).collection<ItemDoc>(COLLECTIONS.items).find(filter).limit(SEARCH_SCAN).toArray();
}

export async function getItems(keys: string[]): Promise<ItemDoc[]> {
  return (await getDb()).collection<ItemDoc>(COLLECTIONS.items).find({ _id: { $in: keys } }).toArray();
}

/** Promos touching any of `keys` (uses the multikey `items` index). */
export async function getPromosFor(keys: string[]): Promise<PromoDoc[]> {
  return (await getDb()).collection<PromoDoc>(COLLECTIONS.promos).find({ items: { $in: keys } }).toArray();
}
