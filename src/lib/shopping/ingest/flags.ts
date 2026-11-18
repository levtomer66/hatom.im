// The price ingest's command-line flags (`npm run shopping:ingest -- …`).
// Pure: ingest/cli.ts hands it process.argv, a test hands it a list.

import { parseArgs } from 'node:util';

export interface IngestFlags {
  /** Chain slugs asked for with --chains, or null for every chain. */
  chains: string[] | null;
  /** --max-stores: a smoke run over the first N stores of each chain; only with --dry-run. */
  maxStores: number | null;
  /** --dry-run: no Mongo, and the registry, keys and written hashes are not saved. */
  dryRun: boolean;
  /** --full: rewrite every doc (new machine / lost state). */
  full: boolean;
  /** --offline: no fetching and no network request at all; rebuilds the docs from saved state. */
  offline: boolean;
  /** Whether raw files past the retention are deleted: only a run that fetches and writes. */
  pruneRaw: boolean;
}

const REMOVED: Record<string, string> = {
  'all-stores': 'a store outside the pins is picked by hand (places/extra.json, official.json, decisions.json)',
  cities: 'the target cities are the ones in cities.ts',
};

export function parseIngestFlags(argv: string[]): IngestFlags {
  for (const arg of argv) {
    const name = /^--([^=]+)/.exec(arg)?.[1];
    if (name && name in REMOVED) throw new Error(`--${name} was removed: ${REMOVED[name]}`);
  }
  const { values } = parseArgs({
    args: argv,
    options: {
      chains: { type: 'string' },
      'max-stores': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      full: { type: 'boolean', default: false },
      offline: { type: 'boolean', default: false },
    },
  });
  const dryRun = values['dry-run'];
  let maxStores: number | null = null;
  if (values['max-stores'] !== undefined) {
    maxStores = Number(values['max-stores']);
    if (!Number.isInteger(maxStores) || maxStores < 1) throw new Error(`--max-stores takes a whole number of stores, got "${values['max-stores']}"`);
    // A sample must never replace a chain's saved stores or reach Mongo.
    if (!dryRun) throw new Error('--max-stores is a sampling smoke run: use it with --dry-run');
  }
  return {
    chains: values.chains ? values.chains.split(',').map((s) => s.trim()).filter(Boolean) : null,
    maxStores,
    dryRun,
    full: values.full,
    offline: values.offline,
    pruneRaw: !dryRun && !values.offline,
  };
}
