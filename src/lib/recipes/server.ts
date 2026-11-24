// Server-only helpers for recipes (not import-free).

import { del, put } from '@vercel/blob';
import { safeImageUrl } from './url';

const MAX_BYTES = 5 * 1024 * 1024;

/** Reads at most `max` bytes of a body; null when it's longer. */
async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel().catch(() => undefined); return null; }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

/**
 * An imported recipe's image, copied into Blob once (Instagram/TikTok image
 * links expire). The URL is untrusted: every hop (≤ 3 redirects) must pass
 * `safeImageUrl`, the body is capped at 5 MB. Null on any failure.
 */
export async function storeImageFromUrl(url: string, id: string): Promise<string | null> {
  try {
    const signal = AbortSignal.timeout(10_000);
    let at = safeImageUrl(url);
    let res: Response | null = null;
    for (let hop = 0; at && hop <= 3; hop++) {
      res = await fetch(at, { signal, redirect: 'manual' });
      if (res.status < 300 || res.status >= 400) break;
      const next = res.headers.get('location');
      at = next ? safeImageUrl(new URL(next, at).toString()) : null;
      res = null;
    }
    if (!res || !res.ok) return null;
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return null;
    const buf = await readCapped(res, MAX_BYTES);
    if (!buf?.length) return null;
    const blob = await put(`recipes/${id}-${Math.random().toString(36).slice(2, 10)}.${type.split('/')[1]}`, buf, { access: 'public', contentType: type });
    return blob.url;
  } catch {
    return null;
  }
}

/** Deletes a recipe photo's blob; a failure only leaves an orphan, never breaks the request. */
export async function dropBlob(url: string | null | undefined): Promise<void> {
  if (!url || !url.includes('.blob.vercel-storage.com/')) return;
  try {
    await del(url);
  } catch (error) {
    console.error('recipes: deleting a photo blob:', error);
  }
}
