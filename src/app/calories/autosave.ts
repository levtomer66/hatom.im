'use client';

// Save as you edit, no save button: `wanted` (undefined while the field holds no
// valid value) is sent `delay` ms after it last changed, unless it equals what
// was saved last. `flush()` sends a change still waiting (the sheet closing,
// Enter). `status` drives the small "שומר… / נשמר ✓" line.

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

  const send = useCallback(async (v: T) => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const k = JSON.stringify(v);
    if (k === saved.current) return;
    setStatus('saving');
    const err = await latest.current(v);
    if (!err) saved.current = k;
    setError(err);
    setStatus(err ? 'idle' : 'saved');
  }, []);

  useEffect(() => {
    if (key === undefined || key === saved.current) return;
    setStatus('idle');
    timer.current = window.setTimeout(() => void send(JSON.parse(key) as T), delay);
    return () => window.clearTimeout(timer.current);
  }, [key, send, delay]);

  /** Sends a change still waiting; resolves once it is saved (at once when nothing waits). */
  const flush = useCallback(async (): Promise<void> => {
    if (timer.current !== undefined && key !== undefined) await send(JSON.parse(key) as T);
  }, [key, send]);

  return { status, error, flush };
}

export const statusText = (s: SaveStatus) => (s === 'saving' ? 'שומר…' : s === 'saved' ? 'נשמר ✓' : ' ');
