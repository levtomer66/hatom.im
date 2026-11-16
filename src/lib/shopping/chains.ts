// Chains the ingest job knows how to fetch. Adding a chain = one entry here
// (and a fetcher in ingest/sources.ts if its access method is new).
// Source details and verification notes: docs/sources.md. Import-free.

export type ChainSource =
  | { kind: 'cerberus'; username: string }
  | { kind: 'shufersal' };

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
];

export const chainBySlug = (slug: string) => CHAINS.find((c) => c.slug === slug);
