// The one Nominatim client (nominatim.openstreetmap.org search), used by the
// ingest's store locator (ingest/locate.ts) and by discovery (ingest/discover.ts).
// Its usage policy allows one request per second: requests go one at a time
// with REQUEST_GAP_MS between them, and a 429 / 503 backs off before a retry.

import { REQUEST_GAP_MS, sleep as realSleep } from './cache.ts';

export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const NOMINATIM_GAP_MS = REQUEST_GAP_MS;
/** The wait after the first 429 / 503; doubled on each of the three retries. */
const BACKOFF_MS = 10_000;
const RETRIES = 3;

/** Nominatim answered with an HTTP error (after the retries, for 429 / 503). */
export class NominatimError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Nominatim ${status}`);
    this.status = status;
  }
}

export interface NetDeps {
  /** A test passes its own; the jobs use the global one. */
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** A search function for one job: `params` are sent as given (q, format, limit, …). */
export function nominatim(userAgent: string, deps: NetDeps = {}): <T>(params: Record<string, string>) => Promise<T[]> {
  const { fetch = globalThis.fetch, sleep = realSleep, now = Date.now } = deps;
  let last = -Infinity;
  return async <T,>(params: Record<string, string>): Promise<T[]> => {
    const url = `${NOMINATIM}?${new URLSearchParams(params)}`;
    for (let attempt = 1; ; attempt++) {
      const wait = last + NOMINATIM_GAP_MS - now();
      if (wait > 0) await sleep(wait);
      last = now();
      const res = await fetch(url, { headers: { 'User-Agent': userAgent, 'Accept-Language': 'he' } });
      if (res.ok) return (await res.json()) as T[];
      // 429 / 503 = slow down: back off 10 s, 20 s, 40 s, then give up.
      if ((res.status !== 429 && res.status !== 503) || attempt > RETRIES) throw new NominatimError(res.status);
      await sleep(BACKOFF_MS * 2 ** (attempt - 1));
    }
  };
}
