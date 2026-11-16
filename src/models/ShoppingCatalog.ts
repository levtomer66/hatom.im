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

/** The city's physical stores without a price file (or, later, any prices at all). */
export async function getUnpricedStoresIn(city: string): Promise<StoreDoc[]> {
  return (await getDb())
    .collection<StoreDoc>(COLLECTIONS.stores)
    .find({ pricesAt: null, city, kind: 'physical' })
    .sort({ chainName: 1, name: 1 })
    .limit(50)
    .toArray();
}

const SEARCH_SCAN = 300;

/**
 * Items whose name contains every term (or whose key is `barcode`), unsorted.
 * Two scans run side by side: names *starting* with the first term, and
 * names containing the terms anywhere. A common word ("חלב") matches far more
 * than SEARCH_SCAN items, and without the first scan the plain "חלב …"
 * products could all fall outside the cap.
 */
export async function findItems(terms: string[], barcode: string | null): Promise<ItemDoc[]> {
  const items = (await getDb()).collection<ItemDoc>(COLLECTIONS.items);
  if (barcode) return items.find({ _id: barcode }).toArray();
  const all = terms.map((t) => ({ n: { $regex: t, $options: 'i' } }));
  const [prefixed, anywhere] = await Promise.all([
    items.find({ $and: [{ n: { $regex: `^[\\d\\s.,]*${terms[0]}`, $options: 'i' } }, ...all.slice(1)] }).limit(SEARCH_SCAN).toArray(),
    items.find({ $and: all }).limit(SEARCH_SCAN).toArray(),
  ]);
  const seen = new Set(prefixed.map((d) => d._id));
  return [...prefixed, ...anywhere.filter((d) => !seen.has(d._id))];
}

export async function getItems(keys: string[]): Promise<ItemDoc[]> {
  return (await getDb()).collection<ItemDoc>(COLLECTIONS.items).find({ _id: { $in: keys } }).toArray();
}

/** Promos touching any of `keys` (uses the multikey `items` index). */
export async function getPromosFor(keys: string[]): Promise<PromoDoc[]> {
  return (await getDb()).collection<PromoDoc>(COLLECTIONS.promos).find({ items: { $in: keys } }).toArray();
}
