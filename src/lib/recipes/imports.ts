// Import requests: a person asks for a link or a caption to be imported, or for
// a recipe written from an idea (a prompt); the cloud import agent claims it, converts it and saves it to their book.
// Import-free (node --test). Spec: § Import agent.

export type ImportStatus = 'queued' | 'working' | 'done' | 'failed';

export interface ImportRequest {
  id: string;
  requester: string;
  url: string | null;
  text: string;
  /** An idea to write a recipe from ('' for link/text requests; older docs lack it). */
  prompt: string;
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
const MAX_PROMPT = 500;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseImportRequest(v: unknown): Result<{ url: string | null; text: string; prompt: string; note: string }> {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const rawUrl = typeof o.url === 'string' ? o.url.trim() : '';
  const text = typeof o.text === 'string' ? o.text.trim() : '';
  const note = typeof o.note === 'string' ? o.note.trim() : '';
  const prompt = typeof o.prompt === 'string' ? o.prompt.trim() : '';
  if (note.length > MAX_NOTE) return { ok: false, error: 'ההערה ארוכה מדי' };
  if (prompt) {
    if (rawUrl || text) return { ok: false, error: 'רעיון לבד, בלי קישור או טקסט' };
    if (prompt.length > MAX_PROMPT) return { ok: false, error: 'הרעיון ארוך מדי' };
    return { ok: true, value: { url: null, text: '', prompt, note } };
  }
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
  if (!url && !text) return { ok: false, error: 'כתבו רעיון, הדביקו קישור או את טקסט המתכון' };
  if (text.length > MAX_TEXT) return { ok: false, error: 'הטקסט ארוך מדי' };
  return { ok: true, value: { url, text, prompt: '', note } };
}

/** An agent may take it: queued, or claimed by a run that never finished. */
export function claimable(r: Pick<ImportRequest, 'status' | 'claimedAt'>, now = Date.now()): boolean {
  if (r.status === 'queued') return true;
  return r.status === 'working' && (!r.claimedAt || now - Date.parse(r.claimedAt) > STALE_MS);
}
