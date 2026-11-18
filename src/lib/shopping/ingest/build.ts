// Saved state → the documents the app reads (item, promo, store and chain
// docs) and the size report. The document shapes are ../snapshot.ts; this
// stage gathers their inputs: each kept store's saved items and promos, the
// photos by barcode and the nutrition rows from the caches.

import { CHAINS, chainBySlug } from '../chains.ts';
import { storeId } from '../collections.ts';
import {
  buildItemDocs, buildPromoDocs, buildStoreDocs,
  type BarcodePhoto, type ItemDoc, type PromoDoc, type StoreDoc, type StoreState,
} from '../snapshot.ts';
import { RAMI_LEVY_IMG, cachedPhotos, readOffNutrition, readRamiLevy, type ProbeCache } from './off.ts';
import type { StateStore, StoreRecord } from './state.ts';

export interface ChainDoc {
  _id: string;
  slug: string;
  name: string;
}

export interface Snapshot {
  chains: Map<string, ChainDoc>;
  stores: Map<string, StoreDoc>;
  items: Map<string, ItemDoc>;
  promos: Map<string, PromoDoc>;
  /** Store copies of coupons with no numeric discount, left out of the promos. */
  droppedCoupons: number;
}

const PLAIN_BARCODE = /^\d{8,14}$/;

/**
 * Photos by barcode for items no priced source photographs: Rami Levy's CDN,
 * then a photo-only Wolt venue, then Open Food Facts (`cached`: the caches
 * filled by `npm run shopping:photos`; the ingest never fetches them).
 * `cached` is filled in and returned.
 */
export function barcodePhotos(
  states: StoreState[],
  src: {
    cached: Map<string, BarcodePhoto>;
    /** Barcodes checked on Rami Levy's CDN, hits and misses (photos/ramilevy.json). */
    probed: ProbeCache;
    /** barcode → photo from the photo-only Wolt venues. */
    wolt: Map<string, string>;
    ramiLevyChainId: string;
  },
): Map<string, BarcodePhoto> {
  const { cached: photos, probed } = src;
  // Rami Levy's CDN has a photo for 99.4% of the barcodes Rami Levy sells (checked
  // 2026-11-17), so those get its link before they're checked; a checked miss wins.
  for (const st of states) {
    if (st.chainId !== src.ramiLevyChainId) continue;
    for (const it of st.items) {
      if (it.barcode && PLAIN_BARCODE.test(it.key) && !(it.key in probed) && !photos.has(it.key)) photos.set(it.key, { img: RAMI_LEVY_IMG(it.key), first: true });
    }
  }
  for (const [k, img] of src.wolt) if (!photos.get(k) || photos.get(k)!.by === 'off') photos.set(k, { img });
  // The owner's call (2026-11-17): every other barcode not yet checked is assumed
  // to be on Rami Levy's CDN too (~91% are) rather than waiting ~17 h of checks.
  // It's the last resort: any photo known to exist wins, and a checked miss is
  // never guessed. Missing ones are reported by hand and probed then.
  for (const st of states) {
    for (const it of st.items) {
      if (it.barcode && !it.img && PLAIN_BARCODE.test(it.key) && !(it.key in probed) && !photos.has(it.key)) photos.set(it.key, { img: RAMI_LEVY_IMG(it.key) });
    }
  }
  return photos;
}

export function buildSnapshot(input: {
  /** The kept stores, in registry order: it decides which chain's wording an item takes first. */
  stores: StoreRecord[];
  keys: Record<string, number>;
  state: StateStore;
  cacheDir: string;
  /** barcode → photo from the photo-only Wolt venues (ingest/wolt.ts woltPhotos). */
  woltPhotos: Map<string, string>;
  /** Israel local "YYYY-MM-DDTHH:mm": promotions over by then are dropped. */
  nowLocal: string;
  log: (msg: string) => void;
}): Snapshot {
  const { keys, log } = input;
  const loaded = input.stores.map((s) => ({ s, st: input.state.load(s) }));
  const states: StoreState[] = loaded.flatMap(({ s, st }) =>
    st ? [{ k: keys[storeId(s)], chainId: s.chainId, storeId: s.storeId, items: st.items, promos: st.promos }] : [],
  );

  const photos = barcodePhotos(states, {
    cached: cachedPhotos(input.cacheDir),
    probed: readRamiLevy(input.cacheDir),
    wolt: input.woltPhotos,
    ramiLevyChainId: chainBySlug('rami-levy')!.chainId,
  });
  log(`photos by barcode: ${photos.size} (Rami Levy + Open Food Facts cache, ${input.woltPhotos.size} from photo-only Wolt venues)`);

  // Nutrition per 100 g from the Open Food Facts export (cached by `npm run shopping:photos -- --off`).
  const nuStats = { used: 0, notFood: 0, implausible: 0, otherProduct: 0 };
  const nuRows = new Map(Object.entries(readOffNutrition(input.cacheDir)?.rows ?? {}));
  const items = buildItemDocs(states, photos, { rows: nuRows, stats: nuStats });
  {
    const docs = [...items.values()];
    const sold = (x: ItemDoc) => Object.keys(x.p).length;
    const all = docs.reduce((t, x) => t + sold(x), 0);
    const withNu = docs.filter((x) => x.nu);
    log(`nutrition: ${withNu.length} items (${Math.round((100 * withNu.reduce((t, x) => t + sold(x), 0)) / Math.max(all, 1))}% weighted by stores) from ${nuRows.size} Open Food Facts rows; dropped — not food ${nuStats.notFood}, implausible ${nuStats.implausible}, another product ${nuStats.otherProduct}`);
  }

  const promoStats = { droppedCoupons: 0 };
  const promos = buildPromoDocs(states, input.nowLocal, promoStats);
  // `loc` is the record's point: where selection placed the store (ingest/select.ts).
  const stores = buildStoreDocs(
    loaded.map(({ s, st }) => ({ ...s, priceFile: st?.priceFile ?? null, promoFile: st?.promoFile ?? null, loc: s.at ?? null })),
    keys,
  );
  const chains = new Map(CHAINS.map((c) => [c.chainId, { _id: c.chainId, slug: c.slug, name: c.name }]));
  return { chains, stores, items, promos, droppedCoupons: promoStats.droppedCoupons };
}

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

/**
 * The size report, as log lines. `sizeOf` is the uncompressed BSON size of a
 * doc — what Atlas M0 counts (the driver's BSON.calculateObjectSize; passed
 * in so this file has no npm import).
 */
export function sizeReport(snap: Snapshot, sizeOf: (doc: object) => number): string[] {
  const size = (m: Map<string, object>) => {
    let n = 0;
    for (const d of m.values()) n += sizeOf(d);
    return n;
  };
  const priceEntries = [...snap.items.values()].reduce((n, d) => n + Object.keys(d.p).length, 0);
  const promoItemEntries = [...snap.promos.values()].reduce((n, d) => n + d.items.length, 0);
  return [
    `snapshot: ${snap.stores.size} stores, ${snap.items.size} items (${priceEntries} store prices), ${snap.promos.size} live promos (${promoItemEntries} promo-item links); dropped ${snap.droppedCoupons} store copies of coupons with no numeric discount`,
    `  BSON: items ${mb(size(snap.items))}, promos ${mb(size(snap.promos))}, stores ${mb(size(snap.stores))}`,
    `  index estimate: promos.items multikey ≈ ${mb(promoItemEntries * 40)}, _id indexes ≈ ${mb((snap.items.size + snap.promos.size) * 40)}`,
  ];
}
