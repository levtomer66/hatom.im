// Import requests: a person asks for a link or a caption to be imported; the
// local import agent claims it, converts it and saves it to their book.
// Import-free (node --test). Spec: § Import agent.

export type ImportStatus = 'queued' | 'working' | 'done' | 'failed';

export interface ImportRequest {
  id: string;
  requester: string;
  url: string | null;
  text: string;
  note: string;
  status: ImportStatus;
  recipeId: string | null;
  error: string | null;
  at: string;
  claimedAt: string | null;
  doneAt: string | null;
}

/** A claim older than this is taken to be from an agent run that died. */
export const STALE_MS = 30 * 60_000;
/** Open (queued or working) requests one person may have. */
export const MAX_OPEN = 5;
const MAX_TEXT = 8000;
const MAX_NOTE = 500;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseImportRequest(v: unknown): Result<{ url: string | null; text: string; note: string }> {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const rawUrl = typeof o.url === 'string' ? o.url.trim() : '';
  const text = typeof o.text === 'string' ? o.text.trim() : '';
  const note = typeof o.note === 'string' ? o.note.trim() : '';
  let url: string | null = null;
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== 'https:' || rawUrl.length > 2000) return { ok: false, error: 'צריך קישור https' };
      url = u.toString();
    } catch {
      return { ok: false, error: 'הקישור לא תקין' };
    }
  }
  if (!url && !text) return { ok: false, error: 'הדביקו קישור או את טקסט המתכון' };
  if (text.length > MAX_TEXT) return { ok: false, error: 'הטקסט ארוך מדי' };
  if (note.length > MAX_NOTE) return { ok: false, error: 'ההערה ארוכה מדי' };
  return { ok: true, value: { url, text, note } };
}

/** An agent may take it: queued, or claimed by a run that never finished. */
export function claimable(r: Pick<ImportRequest, 'status' | 'claimedAt'>, now = Date.now()): boolean {
  if (r.status === 'queued') return true;
  return r.status === 'working' && (!r.claimedAt || now - Date.parse(r.claimedAt) > STALE_MS);
}
