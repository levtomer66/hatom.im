import { useEffect, useRef, useState } from 'react';

export type CopyApiKeyState = 'idle' | 'copying' | 'copied' | 'error';

// Copy the caller's personal API key to the clipboard so it can be pasted into
// an iPhone Shortcut on import. The key is created on first use (POST) if none
// exists yet, and is never returned to the caller or rendered — it goes
// straight to the clipboard. Safari-safe: `clipboard.write` is handed a Promise
// so the async fetch stays inside the user gesture; falls back to `writeText`
// for browsers without promise-valued ClipboardItem support. `copyState` drives
// button feedback and resets to `idle` after a short delay.
export function useCopyApiKey(): {
  copyState: CopyApiKeyState;
  copyApiKey: () => Promise<void>;
} {
  const [copyState, setCopyState] = useState<CopyApiKeyState>('idle');
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  async function copyApiKey() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setCopyState('copying');
    // GET reveals the current key (or null); POST creates one only when none
    // exists yet, so an existing working key is never rotated.
    const keyPromise = (async () => {
      let response = await fetch('/api/user/api-settings', { cache: 'no-store' });
      let data = (await response.json()) as { apiKey: string | null };
      if (response.ok && !data.apiKey) {
        response = await fetch('/api/user/api-settings', { method: 'POST' });
        data = (await response.json()) as { apiKey: string | null };
      }
      if (!response.ok || !data.apiKey) throw new Error('no key');
      return data.apiKey;
    })();
    try {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': keyPromise.then(
              (k) => new Blob([k], { type: 'text/plain' })
            ),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(await keyPromise);
      }
      setCopyState('copied');
      timer.current = window.setTimeout(() => setCopyState('idle'), 2500);
    } catch {
      setCopyState('error');
      timer.current = window.setTimeout(() => setCopyState('idle'), 4000);
    }
  }

  return { copyState, copyApiKey };
}
