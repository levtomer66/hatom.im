// Shopping lists: the shapes the page, API and model share, and input
// validation. Import-free, for `node --test`.

export interface ShoppingListItem {
  /** Item key: a barcode, or "<chainId>:<code>" for chain-internal items. */
  key: string;
  name: string;
  /** Units, or kg when `w`. */
  qty: number;
  /** Sold by weight. */
  w: boolean;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingListItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListPatch {
  name?: string;
  items?: ShoppingListItem[];
}

export const MAX_LIST_ITEMS = 100;
export const MAX_QTY = 100;
const MAX_NAME = 60;
const KEY = /^(\d{1,14}|\d{13}:[\w.-]{1,40})$/;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function parseName(v: unknown): Result<string> {
  if (typeof v !== 'string') return { ok: false, error: 'name must be a string' };
  const name = v.trim();
  if (!name || name.length > MAX_NAME) return { ok: false, error: `name must be 1–${MAX_NAME} characters` };
  return { ok: true, value: name };
}

/** Valid quantity: positive, ≤ MAX_QTY; whole units unless weighted (0.05 kg steps). */
export function normalizeQty(qty: number, w: boolean): number | null {
  if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) return null;
  const q = w ? Math.round(qty * 20) / 20 : Math.round(qty);
  return q > 0 ? q : null;
}

function parseItems(v: unknown): Result<ShoppingListItem[]> {
  if (!Array.isArray(v)) return { ok: false, error: 'items must be an array' };
  if (v.length > MAX_LIST_ITEMS) return { ok: false, error: `at most ${MAX_LIST_ITEMS} items` };
  const out = new Map<string, ShoppingListItem>();
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'bad item' };
    const { key, name, qty, w } = raw as Record<string, unknown>;
    if (typeof key !== 'string' || !KEY.test(key)) return { ok: false, error: 'bad item key' };
    if (typeof name !== 'string' || name.length > 200) return { ok: false, error: 'bad item name' };
    const weighted = w === true;
    const q = typeof qty === 'number' ? normalizeQty(qty, weighted) : null;
    if (q === null) return { ok: false, error: `bad quantity for ${key}` };
    // The same item twice merges into one line.
    const prev = out.get(key);
    out.set(key, { key, name: name.trim(), w: weighted, qty: Math.min(MAX_QTY, (prev?.qty ?? 0) + q) });
  }
  return { ok: true, value: [...out.values()] };
}

export function parseListCreate(body: unknown): Result<{ name: string }> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be an object' };
  const name = parseName((body as Record<string, unknown>).name);
  return name.ok ? { ok: true, value: { name: name.value } } : name;
}

export function parseListPatch(body: unknown): Result<ShoppingListPatch> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be an object' };
  const b = body as Record<string, unknown>;
  const patch: ShoppingListPatch = {};
  if (b.name !== undefined) {
    const name = parseName(b.name);
    if (!name.ok) return name;
    patch.name = name.value;
  }
  if (b.items !== undefined) {
    const items = parseItems(b.items);
    if (!items.ok) return items;
    patch.items = items.value;
  }
  if (patch.name === undefined && patch.items === undefined) return { ok: false, error: 'nothing to update' };
  return { ok: true, value: patch };
}

/**
 * The words of a search query, for an AND of case-insensitive substring
 * matches on the item name. Regex metacharacters are escaped; Hebrew
 * geresh/gershayim variants are folded so ק"ג finds ק״ג.
 */
export function searchTerms(q: string): string[] {
  return q
    .replace(/[״”“]/g, '"')
    .replace(/[׳’]/g, "'")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/["']/g, '["\'״׳]'));
}
