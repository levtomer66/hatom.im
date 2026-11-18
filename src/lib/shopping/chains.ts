// Chains the ingest job knows how to fetch. Adding a chain = one entry here
// (and a fetcher in ingest/sources.ts if its access method is new).
// Source details and verification notes: docs/sources.md. Import-free.

export type ChainSource =
  | { kind: 'cerberus'; username: string }
  | { kind: 'shufersal' }
  /** `https://<host>.binaprojects.com` — a JSON listing per day, two-step download. */
  | { kind: 'bina'; host: string }
  /** laibcatalog.co.il web API, by the chain id (Victory, Mahsani HaShuk). */
  | { kind: 'laibcatalog' }
  /** `https://prices.<site>.co.il` — today's files embedded in the page (Carrefour). */
  | { kind: 'publishprice'; site: string }
  /** prices.super-pharm.co.il — a paged table filtered by file type and day. */
  | { kind: 'superpharm' }
  /** shop.hazi-hinam.co.il/Prices — a paged table filtered by file type and day, blob links. */
  | { kind: 'hazihinam' }
  /** Not a price-transparency chain: Wolt delivery prices for shops that publish none (ingest/wolt.ts). */
  | { kind: 'wolt' }
  /** Shops with no price source at all, listed so users can type prices (ingest/picks.ts manualShops). */
  | { kind: 'manual' };

export interface ChainConfig {
  slug: string;
  chainId: string;
  name: string; // Hebrew display name
  source: ChainSource;
  /**
   * Online stores (StoreType 2) that serve the target cities. Chains publish
   * an online store per fulfilment area (Eilat, Kiryat Haim, a kibbutz, …) and
   * the files don't say which areas each delivers to, so the ones worth
   * listing are picked by hand. An online store whose City is a target city (a
   * pickup point) is kept anyway; every other online store is left out.
   */
  onlineStores?: string[];
}

/** Whether an online store is worth listing: a pickup point in a target city, or on the chain's list. */
export const keepOnlineStore = (chain: ChainConfig | undefined, storeId: string, cityId: string | null) =>
  cityId !== null || (chain?.onlineStores ?? []).includes(storeId);

export const CHAINS: ChainConfig[] = [
  { slug: 'yohananof', chainId: '7290803800003', name: 'יוחננוף', source: { kind: 'cerberus', username: 'yohananof' } },
  { slug: 'shufersal', chainId: '7290027600007', name: 'שופרסל', source: { kind: 'shufersal' }, onlineStores: ['413'] },
  { slug: 'rami-levy', chainId: '7290058140886', name: 'רמי לוי', source: { kind: 'cerberus', username: 'RamiLevi' }, onlineStores: ['39'] },
  { slug: 'tiv-taam', chainId: '7290873255550', name: 'טיב טעם', source: { kind: 'cerberus', username: 'TivTaam' } },
  { slug: 'dor-alon', chainId: '7290492000005', name: 'דור אלון', source: { kind: 'cerberus', username: 'doralon' } },
  { slug: 'fresh-market', chainId: '7290876100000', name: 'פרש מרקט', source: { kind: 'cerberus', username: 'freshmarket' } },
  { slug: 'keshet', chainId: '7290785400000', name: 'קשת טעמים', source: { kind: 'cerberus', username: 'Keshet' } },
  { slug: 'osher-ad', chainId: '7290103152017', name: 'אושר עד', source: { kind: 'cerberus', username: 'osherad' } },
  { slug: 'carrefour', chainId: '7290055700007', name: 'קרפור', source: { kind: 'publishprice', site: 'carrefour' }, onlineStores: ['471', '473'] }, // Carrefour online, Quik
  { slug: 'victory', chainId: '7290696200003', name: 'ויקטורי', source: { kind: 'laibcatalog' }, onlineStores: ['97'] },
  { slug: 'mahsani-hashuk', chainId: '7290661400001', name: 'מחסני השוק', source: { kind: 'laibcatalog' }, onlineStores: ['97'] },
  { slug: 'good-pharm', chainId: '7290058197699', name: 'גוד פארם', source: { kind: 'bina', host: 'goodpharm' } },
  { slug: 'super-pharm', chainId: '7290172900007', name: 'סופר-פארם', source: { kind: 'superpharm' } },
  { slug: 'bareket', chainId: '7290875100001', name: 'סופר ברקת', source: { kind: 'bina', host: 'superbareket' } },
  // Stores file is the main company's; some branches publish prices under a second id (7290058288090) — matched by store number.
  { slug: 'city-market', chainId: '7290058266241', name: 'סיטי מרקט', source: { kind: 'bina', host: 'citymarketkiryatgat' } },
  // Jerusalem branches only: 26 בית הנציב (Talpiot) and 2 צומת פת, curated in places/official.json.
  { slug: 'super-sapir', chainId: '7290058156016', name: 'סופר ספיר', source: { kind: 'bina', host: 'supersapir' } },
  // Mevaseret Zion 25 only (places/official.json).
  { slug: 'zol-vebegadol', chainId: '7290058173198', name: 'זול ובגדול', source: { kind: 'bina', host: 'zolvebegadol' } },
  // No branch near a pin; Holon's מרכבה is picked by hand (places/official.json).
  { slug: 'hazi-hinam', chainId: '7290700100008', name: 'חצי חינם', source: { kind: 'hazihinam' } },
  // The venues come from places/wolt.json in the cache dir (personal, never in the repo).
  { slug: 'wolt', chainId: 'wolt', name: 'וולט', source: { kind: 'wolt' } },
  // Discovered shops marked "include" with no Wolt venue (places/decisions.json in the cache dir).
  { slug: 'manual', chainId: 'manual', name: 'חנות שכונתית', source: { kind: 'manual' } },
];

export const chainBySlug = (slug: string) => CHAINS.find((c) => c.slug === slug);
