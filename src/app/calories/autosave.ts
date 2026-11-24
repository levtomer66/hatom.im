'use client';

// Save as you edit, no save button: `wanted` (undefined while the field holds no
// valid value) is sent `delay` ms after it last changed, unless it equals what
// was saved last. Saves run one at a time, in order (a meal's first save creates
// it — a second one must not race it and create another). `flush()` sends
// whatever isn't saved yet, a failed save included (the sheet closing, Enter).
// `status` drives the small "שומר… / נשמר ✓" line.

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved';

export function useAutosave<T>(wanted: T | undefined, initial: T | undefined, save: (v: T) => Promise<string | null>, delay = 700) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const saved = useRef<string | undefined>(JSON.stringify(initial));
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(save);
  latest.current = save;
  const key = wanted === undefined ? undefined : JSON.stringify(wanted);

  const queue = useRef<Promise<void>>(Promise.resolve());
  /** The last save attempt failed (what's shown isn't stored). */
  const failed = useRef(false);

  const send = useCallback((v: T): Promise<void> => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const k = JSON.stringify(v);
    queue.current = queue.current.then(async () => {
      if (k === saved.current) return; // an earlier save in the queue already stored it
      setStatus('saving');
      const err = await latest.current(v).catch((e: unknown) => (e instanceof Error ? e.message : 'לא נשמר'));
      if (!err) saved.current = k;
      failed.current = !!err;
      setError(err);
      setStatus(err ? 'idle' : 'saved');
    });
    return queue.current;
  }, []);

  useEffect(() => {
    if (key === undefined || key === saved.current) return;
    setStatus('idle');
    timer.current = window.setTimeout(() => void send(JSON.parse(key) as T), delay);
    return () => window.clearTimeout(timer.current);
  }, [key, send, delay]);

  /** Sends what isn't saved yet (a pending change or a failed one); resolves once the queue is done, true when all of it is stored. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (key !== undefined && key !== saved.current) await send(JSON.parse(key) as T);
    else await queue.current;
    return !failed.current && (key === undefined || key === saved.current);
  }, [key, send]);

  return { status, error, flush };
}

export const statusText = (s: SaveStatus) => (s === 'saving' ? 'שומר…' : s === 'saved' ? 'נשמר ✓' : ' ');
