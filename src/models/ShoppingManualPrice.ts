import clientPromise from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/shopping/collections';
import { manualPriceId, type ManualPrice } from '@/lib/shopping/manual';

// Prices people typed for manual stores (source 'manual'). Shared by everyone
// holding `shopping`, like the lists; `by` is informational. The one shopping
// collection the app writes — the ingest never touches it.

type ManualPriceDoc = ManualPrice & { _id: string };

async function getCollection() {
  return (await clientPromise).db().collection<ManualPriceDoc>(COLLECTIONS.manualPrices);
}

/** Typed prices for any of `items` at any of `stores`. */
export async function getManualPrices(stores: number[], items: string[]): Promise<ManualPrice[]> {
  if (!stores.length || !items.length) return [];
  const docs = await (await getCollection())
    .find({ s: { $in: stores }, i: { $in: items } }, { projection: { _id: 0 } })
    .toArray();
  return docs;
}

export async function setManualPrice(store: number, item: string, price: number, by: string): Promise<ManualPrice> {
  const doc: ManualPrice = { s: store, i: item, p: price, by, at: new Date().toISOString() };
  await (await getCollection()).replaceOne({ _id: manualPriceId(store, item) }, doc, { upsert: true });
  return doc;
}

export async function clearManualPrice(store: number, item: string): Promise<boolean> {
  const r = await (await getCollection()).deleteOne({ _id: manualPriceId(store, item) });
  return r.deletedCount > 0;
}

/** Which of `stores` have at least one typed price. */
export async function getStoresWithManualPrices(stores: number[]): Promise<Set<number>> {
  if (!stores.length) return new Set();
  const ks = await (await getCollection()).distinct('s', { s: { $in: stores } });
  return new Set(ks as number[]);
}
