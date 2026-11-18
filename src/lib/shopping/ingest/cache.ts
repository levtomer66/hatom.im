// Shared file helpers of the local jobs (ingest, discover, photos), all under
// the cache dir: $SHOPPING_CACHE_DIR or ~/.cache/hatom-shopping.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** A JSON file's content, or `fallback` when the file doesn't exist. */
export const readJson = <T,>(path: string, fallback: T): T => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback);

/** `indent` is part of a file's format: the files the owner reads by eye are written with 1. */
export const writeJson = (path: string, v: unknown, indent?: number) => writeFileSync(path, JSON.stringify(v, null, indent));

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The least time between two requests to one host (every source: chains, Wolt, Nominatim, the walk router). */
export const REQUEST_GAP_MS = 1500;
