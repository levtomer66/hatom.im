import clientPromise from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/shopping/collections';
import type { ItemDoc, PromoDoc, StoreDoc } from '@/lib/shopping/snapshot';
import { SEARCH_CANDIDATES, searchStage } from '@/lib/shopping/search-index';

// Read side of the price data the local ingest job writes
// (src/lib/shopping/ingest/cli.ts). The app never writes these collections.

async function getDb() {
  return (await clientPromise).db();
}

/**
 * Stores that serve `city`: its physical stores plus every online store —
 * those with published prices, and the city's manual stores, which are listed
 * even before anyone has typed a price.
 */
export async function getStoresFor(city: string): Promise<StoreDoc[]> {
  return (await getDb())
    .collection<StoreDoc>(COLLECTIONS.stores)
    .find({
      $or: [
        { pricesAt: { $ne: null }, $or: [{ city, kind: 'physical' }, { kind: 'online' }] },
        { source: 'manual', city },
      ],
    })
    .toArray();
}

export async function getStoreByKey(k: number): Promise<StoreDoc | null> {
  return (await getDb()).collection<StoreDoc>(COLLECTIONS.stores).findOne({ k });
}

const SEARCH_SCAN = 300;

/**
 * Items matching every term (regex sources from searchPatterns) in the name
 * or manufacturer, or whose key is `barcode`; unsorted.
 * Two scans run side by side: names *starting* with the first term, and
 * names containing the terms anywhere. A common word ("חלב") matches far more
 * than SEARCH_SCAN items, and without the first scan the plain "חלב …"
 * products could all fall outside the cap.
 */
export async function findItems(terms: string[], barcode: string | null, opts: { namesOnly?: boolean } = {}): Promise<ItemDoc[]> {
  const items = (await getDb()).collection<ItemDoc>(COLLECTIONS.items);
  if (barcode) return items.find({ _id: barcode }).toArray();
  // Each word in the name, the manufacturer, or `s` (every chain's names and
  // makers, when the ingest provides it).
  // Hebrew has no case: the 'i' flag only costs time there (about 40% of a scan).
  const all = terms.map((t) => {
    const re = /[a-z]/i.test(t) ? { $regex: t, $options: 'i' } : { $regex: t };
    return opts.namesOnly ? { n: re } : { $or: [{ n: re }, { m: re }, { s: re }] };
  });
  const [prefixed, anywhere] = await Promise.all([
    items.find({ $and: [{ n: { $regex: `^[\\d\\s.,]*${terms[0]}`, $options: 'i' } }, ...all.slice(1)] }).limit(SEARCH_SCAN).toArray(),
    items.find({ $and: all }).limit(SEARCH_SCAN).toArray(),
  ]);
  const seen = new Set(prefixed.map((d) => d._id));
  return [...prefixed, ...anywhere.filter((d) => !seen.has(d._id))];
}

/** When $search last failed (no Atlas Search here); skip it for a while instead of failing every query. */
let searchDownAt = 0;
const SEARCH_RETRY_MS = 5 * 60 * 1000;

/**
 * Word search through Atlas Search (index and query in search-index.ts):
 * up to SEARCH_CANDIDATES items, fuzzy, unsorted for the caller's ranking.
 * Null when $search isn't available (Docker Mongo, or the index missing), so
 * the caller falls back to findItems' regex search.
 */
export async function searchItemsAtlas(q: string): Promise<ItemDoc[] | null> {
  const stage = searchStage(q);
  if (!stage || Date.now() - searchDownAt < SEARCH_RETRY_MS) return null;
  try {
    return await (await getDb())
      .collection<ItemDoc>(COLLECTIONS.items)
      .aggregate<ItemDoc>([stage, { $limit: SEARCH_CANDIDATES }])
      .toArray();
  } catch (error) {
    searchDownAt = Date.now();
    console.warn('Atlas Search unavailable, using the regex search:', (error as Error).message);
    return null;
  }
}

/**
 * For "לא היה": items the store sells, in the same department (when known),
 * whose name has one of `words`; cheapest first, at most 5.
 */
export async function findAlternatives(store: number, d: string | null, words: string[], exclude: string) {
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sk = `p.${store}`;
  const docs = await (await getDb())
    .collection<ItemDoc>(COLLECTIONS.items)
    .find({ [sk]: { $exists: true }, _id: { $ne: exclude }, ...(d ? { d } : {}), n: { $regex: words.map(esc).join('|') } })
    .project<ItemDoc>({ n: 1, w: 1, img: 1, d: 1, [sk]: 1 })
    .limit(200)
    .toArray();
  return docs
    .map((x) => ({ key: x._id, name: x.n, w: x.w, img: x.img ?? null, d: x.d ?? null, price: x.p[String(store)] }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);
}

export async function getItems(keys: string[]): Promise<ItemDoc[]> {
  return (await getDb()).collection<ItemDoc>(COLLECTIONS.items).find({ _id: { $in: keys } }).toArray();
}

/** Promos touching any of `keys` (uses the multikey `items` index). */
export async function getPromosFor(keys: string[]): Promise<PromoDoc[]> {
  return (await getDb()).collection<PromoDoc>(COLLECTIONS.promos).find({ items: { $in: keys } }).toArray();
}
