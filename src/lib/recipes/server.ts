// Server-only helpers for recipes (not import-free).

import { del, put } from '@vercel/blob';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * An imported recipe's image, copied into Blob once (Instagram/TikTok image
 * links expire). Null on any failure: a timeout, not an image, too big.
 */
export async function storeImageFromUrl(url: string, id: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return null;
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES || !buf.length) return null;
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
