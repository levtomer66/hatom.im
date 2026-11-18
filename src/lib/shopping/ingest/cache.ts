// The cache dir of the local jobs (ingest, discover, photos) and the file
// helpers they share: $SHOPPING_CACHE_DIR or ~/.cache/hatom-shopping.
//
//   raw/<chain>/<file>        downloaded files, pruned after 7 days, never re-downloaded
//   state/stores/<chain>-<store>.json.gz   latest parsed items+promos per store (ingest/state.ts)
//   state/stores.json         the store registry; keys.json: store → short key
//   state/written.json        content hashes of what Mongo holds (drives the diff)
//   places/                   the owner's files (ingest/picks.ts) and the geocode / walk caches
//   logs/<run>.log            what a run said, warnings included
//
// Not in the repo: writes under the repo root trigger the `next dev` recompile loop.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { decodeXmlBytes, isGzip } from '../xml.ts';

/** The least time between two requests to one host (every source: chains, Wolt, Nominatim, the walk router). */
export const REQUEST_GAP_MS = 1500;
export const RAW_RETENTION_DAYS = 7;

export interface CachePaths {
  root: string;
  raw: string;
  state: string;
  storeState: string;
  logs: string;
  /** The owner's folder: read, never created. */
  places: string;
}

export function cachePaths(env: Record<string, string | undefined> = process.env): CachePaths {
  const root = env.SHOPPING_CACHE_DIR || join(homedir(), '.cache', 'hatom-shopping');
  const state = join(root, 'state');
  return { root, raw: join(root, 'raw'), state, storeState: join(state, 'stores'), logs: join(root, 'logs'), places: join(root, 'places') };
}

export function ensureCacheDirs(p: CachePaths): void {
  for (const d of [p.raw, p.storeState, p.logs]) mkdirSync(d, { recursive: true });
}

/** A JSON file's content, or `fallback` when the file doesn't exist. */
export const readJson = <T,>(path: string, fallback: T): T => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback);

/** `indent` is part of a file's format: the files the owner reads by eye are written with 1. */
export const writeJson = (path: string, v: unknown, indent?: number) => writeFileSync(path, JSON.stringify(v, null, indent));

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A downloaded file as XML text: gunzipped when it is gzip, decoded by its declared encoding. */
export const toXml = (bytes: Uint8Array) => decodeXmlBytes(isGzip(bytes) ? new Uint8Array(gunzipSync(bytes)) : bytes);

/** Cached download: a file name we already have is never fetched again. */
export async function fetchCached<F extends { name: string }>(rawDir: string, chainSlug: string, file: F, download: (f: F) => Promise<Uint8Array>): Promise<Uint8Array> {
  const dir = join(rawDir, chainSlug);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, file.name);
  if (existsSync(path)) return new Uint8Array(readFileSync(path));
  const bytes = await download(file);
  writeFileSync(path, bytes);
  return bytes;
}

/** Deletes raw files past the retention; returns how many. */
export function pruneRaw(rawDir: string, log: (msg: string) => void, now = Date.now()): number {
  const cutoff = now - RAW_RETENTION_DAYS * 86_400_000;
  let n = 0;
  for (const chain of readdirSync(rawDir)) {
    for (const f of readdirSync(join(rawDir, chain))) {
      const p = join(rawDir, chain, f);
      if (statSync(p).mtimeMs < cutoff) {
        rmSync(p);
        n++;
      }
    }
  }
  if (n) log(`pruned ${n} raw files older than ${RAW_RETENTION_DAYS} days`);
  return n;
}

export interface RunLog {
  /** The run's id: its start time, safe for a file name. */
  id: string;
  file: string;
  log(msg: string): void;
  warn(msg: string): void;
}

/** A run's log: every line goes to the console and to logs/<run>.log. */
export function runLog(logsDir: string, started = new Date(), out: { log(msg: string): void; warn(msg: string): void } = console): RunLog {
  const id = started.toISOString().replace(/[:.]/g, '-');
  const file = join(logsDir, `${id}.log`);
  return {
    id,
    file,
    log(msg) {
      out.log(msg);
      appendFileSync(file, msg + '\n');
    },
    warn(msg) {
      out.warn(`! ${msg}`);
      appendFileSync(file, `WARN ${msg}\n`);
    },
  };
}
