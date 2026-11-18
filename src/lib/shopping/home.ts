// The household's "My items" and its one shopping list: shapes and pure
// rules shared by the page, the API, trips and MCP. Import-free, for
// `node --test`. Stored as one Mongo doc (src/models/ShoppingHome.ts).
// Spec: docs/superpowers/specs/2026-11-18-shopping-my-items-design.md

/** A line on the shopping list — the shape the comparison takes. */
export interface ListLine {
  /** Item key: a barcode, or "<chainId>:<code>" for chain-internal items. */
  key: string;
  name: string;
  /** Units, or kg when `w`. On a My item: the usual amount. */
  qty: number;
  /** Sold by weight. */
  w: boolean;
}

/** A product the household usually buys. */
export interface MyItem extends ListLine {
  addedBy: string;
  addedAt: string;
}

export interface ShoppingHome {
  items: MyItem[];
  list: ListLine[];
  /** Favorite store keys (any city), at most MAX_FAV_STORES, in the order starred. */
  favStores: number[];
  updatedAt: string;
}

/** The `listId` trips store for the household's one list. */
export const HOME_LIST_ID = 'home';

export const MAX_MY_ITEMS = 300;
export const MAX_LIST_ITEMS = 100;
export const MAX_QTY = 100;
export const MAX_FAV_STORES = 10;
const KEY = /^(\d{1,14}|\d{13}:[\w.-]{1,40})$/;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Valid quantity: positive, ≤ MAX_QTY; whole units unless weighted (0.05 kg steps). */
export function normalizeQty(qty: number, w: boolean): number | null {
  if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) return null;
  const q = w ? Math.round(qty * 20) / 20 : Math.round(qty);
  return q > 0 ? q : null;
}

function parseLine(raw: unknown): Result<ListLine> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'bad item' };
  const { key, name, qty, w } = raw as Record<string, unknown>;
  if (typeof key !== 'string' || !KEY.test(key)) return { ok: false, error: 'bad item key' };
  if (typeof name !== 'string' || name.length > 200) return { ok: false, error: 'bad item name' };
  const weighted = w === true;
  const q = typeof qty === 'number' ? normalizeQty(qty, weighted) : null;
  if (q === null) return { ok: false, error: `bad quantity for ${key}` };
  return { ok: true, value: { key, name: name.trim(), w: weighted, qty: q } };
}

/** The list from a PATCH body: the same item twice merges into one line (quantities add). */
/** The household's favorite store keys: integers, deduped (first kept), at most MAX_FAV_STORES. */
export function parseFavStores(v: unknown): Result<number[]> {
  if (!Array.isArray(v)) return { ok: false, error: 'favStores must be an array' };
  const out: number[] = [];
  for (const k of v) {
    if (!Number.isInteger(k)) return { ok: false, error: 'a store key must be an integer' };
    if (!out.includes(k)) out.push(k);
  }
  if (out.length > MAX_FAV_STORES) return { ok: false, error: 'אפשר עד 10 חנויות מועדפות' };
  return { ok: true, value: out };
}

/**
 * POST /far's `stores`: the favorites as the page has them now. Sent with the
 * request (not read from the saved doc) so pricing never waits for, or races,
 * the debounced save of a star just tapped.
 */
export const farStores = (body: unknown): Result<number[]> =>
  parseFavStores(body && typeof body === 'object' ? (body as { stores?: unknown }).stores : undefined);

export function parseList(v: unknown): Result<ListLine[]> {
  if (!Array.isArray(v)) return { ok: false, error: 'list must be an array' };
  if (v.length > MAX_LIST_ITEMS) return { ok: false, error: `at most ${MAX_LIST_ITEMS} items` };
  const out = new Map<string, ListLine>();
  for (const raw of v) {
    const r = parseLine(raw);
    if (!r.ok) return r;
    const prev = out.get(r.value.key);
    out.set(r.value.key, { ...r.value, qty: Math.min(MAX_QTY, (prev?.qty ?? 0) + r.value.qty) });
  }
  return { ok: true, value: [...out.values()] };
}

/** My items from a PATCH body; an item already saved keeps who added it and when. */
export function parseMyItems(v: unknown, by: string, now: string, prev: MyItem[]): Result<MyItem[]> {
  if (!Array.isArray(v)) return { ok: false, error: 'items must be an array' };
  if (v.length > MAX_MY_ITEMS) return { ok: false, error: `at most ${MAX_MY_ITEMS} items` };
  const before = new Map(prev.map((i) => [i.key, i]));
  const out = new Map<string, MyItem>();
  for (const raw of v) {
    const r = parseLine(raw);
    if (!r.ok) return r;
    if (out.has(r.value.key)) continue;
    const old = before.get(r.value.key);
    out.set(r.value.key, { ...r.value, addedBy: old?.addedBy ?? by, addedAt: old?.addedAt ?? now });
  }
  return { ok: true, value: [...out.values()] };
}

/** The "מה חסר?" submit: `{ add: [{ key, qty }] }`. Quantities are checked against the item later. */
export function parsePicks(body: unknown): Result<{ key: string; qty: number }[]> {
  const add = body && typeof body === 'object' ? (body as Record<string, unknown>).add : undefined;
  if (!Array.isArray(add)) return { ok: false, error: 'add must be an array' };
  if (add.length > MAX_LIST_ITEMS) return { ok: false, error: `at most ${MAX_LIST_ITEMS} items` };
  const out: { key: string; qty: number }[] = [];
  for (const raw of add) {
    const { key, qty } = (raw ?? {}) as Record<string, unknown>;
    if (typeof key !== 'string' || !KEY.test(key)) return { ok: false, error: 'bad item key' };
    out.push({ key, qty: typeof qty === 'number' ? qty : Number.NaN });
  }
  return { ok: true, value: out };
}

/** Picked My items → list lines; an unusable quantity falls back to the usual one, unknown keys drop. */
export function pickMissing(items: MyItem[], picks: { key: string; qty: number }[]): ListLine[] {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const out: ListLine[] = [];
  for (const p of picks) {
    const it = byKey.get(p.key);
    if (!it) continue;
    out.push({ key: it.key, name: it.name, w: it.w, qty: normalizeQty(p.qty, it.w) ?? it.qty });
  }
  return out;
}

/** Adds lines to the list: a key already there keeps its quantity (it may be edited for this shop). */
export function addToList(list: ListLine[], lines: ListLine[]): ListLine[] {
  const out = [...list];
  const have = new Set(list.map((l) => l.key));
  for (const l of lines) {
    if (out.length >= MAX_LIST_ITEMS) break;
    if (have.has(l.key)) continue;
    have.add(l.key);
    out.push(l);
  }
  return out;
}

/** Lines in `after` whose key wasn't on `before` — what an add actually put on the list. */
export function linesAdded(before: ListLine[], after: ListLine[]): ListLine[] {
  const had = new Set(before.map((l) => l.key));
  return after.filter((l) => !had.has(l.key));
}

/** After a trip: drop what was ticked, unless it was also marked not there. */
export function removeBought(list: ListLine[], ticked: string[], notThere: string[]): ListLine[] {
  const gone = new Set(ticked.filter((k) => !notThere.includes(k)));
  return list.filter((l) => !gone.has(l.key));
}

/**
 * The one-time migration: every item of every old named list, once per key,
 * at the largest quantity seen, with the name of the most recently updated list.
 */
export function homeFromLists(lists: { items: ListLine[]; createdBy: string; updatedAt: string }[]): MyItem[] {
  const out = new Map<string, MyItem>();
  for (const l of [...lists].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))) {
    for (const i of l.items) {
      const prev = out.get(i.key);
      out.set(i.key, {
        key: i.key, name: i.name, w: i.w, qty: Math.max(prev?.qty ?? 0, i.qty),
        addedBy: l.createdBy, addedAt: prev?.addedAt ?? l.updatedAt,
      });
    }
  }
  return [...out.values()].slice(0, MAX_MY_ITEMS);
}
