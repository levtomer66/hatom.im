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
];

export const chainBySlug = (slug: string) => CHAINS.find((c) => c.slug === slug);
