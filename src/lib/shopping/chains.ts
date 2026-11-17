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
  /** Not a price-transparency chain: Wolt delivery prices for shops that publish none (ingest/wolt.ts). */
  | { kind: 'wolt' }
  /** Shops with no price source at all, listed so users can type prices (ingest/manual.ts). */
  | { kind: 'manual' };

export interface ChainConfig {
  slug: string;
  chainId: string;
  name: string; // Hebrew display name
  source: ChainSource;
}

export const CHAINS: ChainConfig[] = [
  { slug: 'yohananof', chainId: '7290803800003', name: 'יוחננוף', source: { kind: 'cerberus', username: 'yohananof' } },
  { slug: 'shufersal', chainId: '7290027600007', name: 'שופרסל', source: { kind: 'shufersal' } },
  { slug: 'rami-levy', chainId: '7290058140886', name: 'רמי לוי', source: { kind: 'cerberus', username: 'RamiLevi' } },
  { slug: 'tiv-taam', chainId: '7290873255550', name: 'טיב טעם', source: { kind: 'cerberus', username: 'TivTaam' } },
  { slug: 'dor-alon', chainId: '7290492000005', name: 'דור אלון', source: { kind: 'cerberus', username: 'doralon' } },
  { slug: 'fresh-market', chainId: '7290876100000', name: 'פרש מרקט', source: { kind: 'cerberus', username: 'freshmarket' } },
  { slug: 'keshet', chainId: '7290785400000', name: 'קשת טעמים', source: { kind: 'cerberus', username: 'Keshet' } },
  { slug: 'osher-ad', chainId: '7290103152017', name: 'אושר עד', source: { kind: 'cerberus', username: 'osherad' } },
  { slug: 'carrefour', chainId: '7290055700007', name: 'קרפור', source: { kind: 'publishprice', site: 'carrefour' } },
  { slug: 'victory', chainId: '7290696200003', name: 'ויקטורי', source: { kind: 'laibcatalog' } },
  { slug: 'mahsani-hashuk', chainId: '7290661400001', name: 'מחסני השוק', source: { kind: 'laibcatalog' } },
  { slug: 'bareket', chainId: '7290875100001', name: 'סופר ברקת', source: { kind: 'bina', host: 'superbareket' } },
  // Stores file is the main company's; some branches publish prices under a second id (7290058288090) — matched by store number.
  { slug: 'city-market', chainId: '7290058266241', name: 'סיטי מרקט', source: { kind: 'bina', host: 'citymarketkiryatgat' } },
  // The venues come from places/wolt.json in the cache dir (personal, never in the repo).
  { slug: 'wolt', chainId: 'wolt', name: 'וולט', source: { kind: 'wolt' } },
  // Discovered shops marked "include" with no Wolt venue (places/decisions.json in the cache dir).
  { slug: 'manual', chainId: 'manual', name: 'חנות שכונתית', source: { kind: 'manual' } },
];

export const chainBySlug = (slug: string) => CHAINS.find((c) => c.slug === slug);
