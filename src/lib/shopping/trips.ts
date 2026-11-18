// Shopping trips: a plan taken into the store (docs/shopping-in-store-mode.md).
// Shapes shared by the page, the API and the model, input validation, and
// the checklist's grouping. Import-free apart from the departments registry
// (itself import-free), for `node --test`.

import { DEPARTMENTS } from './departments.ts';

export type PlanKind = 'cheapest' | 'one-store';

export interface TripItem {
  key: string;
  name: string;
  /** Units, or kg when `w`. */
  qty: number;
  w: boolean;
  /** Estimated cost at this stop for `qty`, agorot, as priced when the trip started. */
  cost: number;
  /** Department id (departments.ts), or null: shown under "אחר". */
  d: string | null;
  img: string | null;
  /** 'off' = an Open Food Facts photo (credit it), 'name' = borrowed from a similar product. */
  imgBy?: 'name' | 'off' | null;
  /** A deal this quantity doesn't reach yet ("3ב20" from 3 units), for the in-store nudge. */
  deal?: { text: string; minQty: number } | null;
}

export interface TripStop {
  store: number;
  storeName: string;
  items: TripItem[];
}

export interface Trip {
  id: string;
  listId: string;
  plan: PlanKind;
  /** Trips started before 2026-11-18 carry the old city; no longer written or read. */
  city?: string;
  stops: TripStop[];
  /** Items no stop sells, kept so the checklist can mention them. */
  missing: { key: string; name: string }[];
  /** Sum of the stops' costs when the trip started, agorot. */
  estimate: number;
  /** Item keys ticked so far (anyone on the trip). */
  ticked: string[];
  /** Item keys marked "לא היה" (not on the shelf); they don't count toward progress. */
  notThere: string[];
  startedBy: string;
  startedAt: string;
  endedAt: string | null;
}

export type TripCreate = Pick<Trip, 'listId' | 'plan' | 'stops' | 'missing' | 'estimate'>;

export type TripPatch =
  | { tick: { key: string; on: boolean } }
  | { notThere: { key: string; on: boolean } }
  /** Swap an item for another product (the "לא היה" suggestion). */
  | { replace: { key: string; item: TripItem } }
  /** Buy an item at another stop of the plan instead. */
  | { move: { key: string; toStore: number } }
  /** Change an item's quantity (the deal nudge's "+1"); its cost scales with it. */
  | { qty: { key: string; qty: number } }
  /** Add the list lines the trip doesn't have yet (added after it started), each at its cheapest stop. */
  | { sync: true }
  /** Close the trip. Older clients also sent {paid}; it's ignored. */
  | { end: true };

const MAX_STOPS = 3;
const MAX_ITEMS = 100;
const MAX_AGOROT = 10_000_000;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isAgorot = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_AGOROT;

function parseItem(raw: unknown): TripItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.key, 60) || !isStr(r.name) || typeof r.qty !== 'number' || !(r.qty > 0) || r.qty > 100) return null;
  if (!isAgorot(r.cost)) return null;
  const d = typeof r.d === 'string' && r.d.length <= 40 ? r.d : null;
  const img = typeof r.img === 'string' && r.img.startsWith('https://') && r.img.length <= 500 ? r.img : null;
  const dl = r.deal as Record<string, unknown> | null | undefined;
  const deal = dl && isStr(dl.text) && typeof dl.minQty === 'number' && dl.minQty > 0 && dl.minQty <= 100
    ? { text: dl.text, minQty: dl.minQty } : null;
  const imgBy = r.imgBy === 'off' || r.imgBy === 'name' ? r.imgBy : null;
  return { key: r.key, name: r.name, qty: r.qty, w: r.w === true, cost: r.cost, d, img, imgBy, deal };
}

export function parseTripCreate(body: unknown): Result<TripCreate> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be an object' };
  const b = body as Record<string, unknown>;
  if (!isStr(b.listId, 40)) return { ok: false, error: 'listId is required' };
  if (b.plan !== 'cheapest' && b.plan !== 'one-store') return { ok: false, error: 'plan must be cheapest or one-store' };
  if (!Array.isArray(b.stops) || !b.stops.length || b.stops.length > MAX_STOPS) return { ok: false, error: `1–${MAX_STOPS} stops` };
  const stops: TripStop[] = [];
  const seen = new Set<string>();
  for (const raw of b.stops as Record<string, unknown>[]) {
    if (!raw || !Number.isInteger(raw.store) || !isStr(raw.storeName)) return { ok: false, error: 'bad stop' };
    if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) return { ok: false, error: 'bad stop items' };
    const items: TripItem[] = [];
    for (const it of raw.items) {
      const item = parseItem(it);
      if (!item) return { ok: false, error: 'bad item' };
      if (seen.has(item.key)) return { ok: false, error: `item ${item.key} is in two stops` };
      seen.add(item.key);
      items.push(item);
    }
    stops.push({ store: raw.store as number, storeName: raw.storeName as string, items });
  }
  const missing = Array.isArray(b.missing)
    ? (b.missing as Record<string, unknown>[]).filter((m) => m && isStr(m.key, 60) && isStr(m.name)).slice(0, MAX_ITEMS)
      .map((m) => ({ key: m.key as string, name: m.name as string }))
    : [];
  if (!isAgorot(b.estimate)) return { ok: false, error: 'estimate must be agorot' };
  return { ok: true, value: { listId: b.listId, plan: b.plan, stops, missing, estimate: b.estimate } };
}

export function parseTripPatch(body: unknown): Result<TripPatch> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be an object' };
  const b = body as Record<string, unknown>;
  if (b.tick && typeof b.tick === 'object') {
    const t = b.tick as Record<string, unknown>;
    if (!isStr(t.key, 60) || typeof t.on !== 'boolean') return { ok: false, error: 'tick needs key and on' };
    return { ok: true, value: { tick: { key: t.key, on: t.on } } };
  }
  if (b.notThere && typeof b.notThere === 'object') {
    const t = b.notThere as Record<string, unknown>;
    if (!isStr(t.key, 60) || typeof t.on !== 'boolean') return { ok: false, error: 'notThere needs key and on' };
    return { ok: true, value: { notThere: { key: t.key, on: t.on } } };
  }
  if (b.replace && typeof b.replace === 'object') {
    const t = b.replace as Record<string, unknown>;
    const item = parseItem(t.item);
    if (!isStr(t.key, 60) || !item) return { ok: false, error: 'replace needs key and a valid item' };
    return { ok: true, value: { replace: { key: t.key, item } } };
  }
  if (b.move && typeof b.move === 'object') {
    const t = b.move as Record<string, unknown>;
    if (!isStr(t.key, 60) || !Number.isInteger(t.toStore)) return { ok: false, error: 'move needs key and toStore' };
    return { ok: true, value: { move: { key: t.key, toStore: t.toStore as number } } };
  }
  if (b.qty && typeof b.qty === 'object') {
    const t = b.qty as Record<string, unknown>;
    if (!isStr(t.key, 60) || typeof t.qty !== 'number' || !(t.qty > 0) || t.qty > 100) return { ok: false, error: 'qty needs key and 0 < qty ≤ 100' };
    return { ok: true, value: { qty: { key: t.key, qty: t.qty } } };
  }
  if (b.sync === true) return { ok: true, value: { sync: true } };
  if (b.end) return { ok: true, value: { end: true } };
  return { ok: false, error: 'nothing to do' };
}

// ---- the checklist ----

export const OTHER_DEPARTMENT = { id: 'other', name: 'אחר' } as const;

export interface DepartmentGroup {
  id: string;
  name: string;
  /** Not ticked first (in list order), then ticked. */
  items: TripItem[];
  left: number;
}

/**
 * A stop's items by department, in the store's walking order (DEPARTMENTS),
 * items without a known department last under "אחר". Within a department,
 * ticked items sink to the bottom.
 */
export function groupByDepartment(items: TripItem[], ticked: Set<string>): DepartmentGroup[] {
  const order = new Map(DEPARTMENTS.map((d, i) => [d.id, i]));
  const groups = new Map<string, TripItem[]>();
  for (const it of items) {
    const id = it.d && order.has(it.d) ? it.d : OTHER_DEPARTMENT.id;
    groups.set(id, [...(groups.get(id) ?? []), it]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))
    .map(([id, list]) => ({
      id,
      name: DEPARTMENTS.find((d) => d.id === id)?.name ?? OTHER_DEPARTMENT.name,
      items: [...list.filter((i) => !ticked.has(i.key)), ...list.filter((i) => ticked.has(i.key))],
      left: list.filter((i) => !ticked.has(i.key)).length,
    }));
}

/** "₪84 מתוך ₪132": the ticked items' estimated cost against the trip's estimate. */
export function progress(trip: Pick<Trip, 'stops' | 'ticked' | 'estimate'> & { notThere?: string[] }): { done: number; total: number; count: number; of: number } {
  const ticked = new Set(trip.ticked);
  const gone = new Set(trip.notThere ?? []);
  const all = trip.stops.flatMap((s) => s.items).filter((i) => !gone.has(i.key));
  return {
    done: all.filter((i) => ticked.has(i.key)).reduce((s, i) => s + i.cost, 0),
    total: all.reduce((s, i) => s + i.cost, 0) || trip.estimate,
    count: all.filter((i) => ticked.has(i.key)).length,
    of: all.length,
  };
}

/**
 * The server's ticks with the taps still on their way laid over them, so a
 * late or out-of-order reply (or a poll) never undoes a tap that hasn't
 * landed yet. `pending`: item key → the state the latest unanswered tap set.
 */
export function withPending(ticked: string[], pending: Map<string, boolean>): string[] {
  const out = new Set(ticked);
  for (const [key, on] of pending) {
    if (on) out.add(key);
    else out.delete(key);
  }
  return [...out];
}

/**
 * A trip's stops after a "לא היה" swap, a move to another stop or a quantity
 * change. Returns null when the change doesn't apply (no such item, the
 * target stop missing, the new product already on the trip).
 */
export function applyStopsChange(stops: TripStop[], p: Extract<TripPatch, { replace: unknown } | { move: unknown } | { qty: unknown }>): TripStop[] | null {
  const key = 'replace' in p ? p.replace.key : 'move' in p ? p.move.key : p.qty.key;
  const from = stops.findIndex((s) => s.items.some((i) => i.key === key));
  if (from < 0) return null;
  const item = stops[from].items.find((i) => i.key === key)!;
  if ('replace' in p) {
    if (stops.some((s) => s.items.some((i) => i.key === p.replace.item.key))) return null;
    return stops.map((s, i) => (i === from ? { ...s, items: s.items.map((x) => (x.key === key ? p.replace.item : x)) } : s));
  }
  if ('move' in p) {
    const to = stops.findIndex((s) => s.store === p.move.toStore);
    if (to < 0 || to === from) return null;
    return stops.map((s, i) => (
      i === from ? { ...s, items: s.items.filter((x) => x.key !== key) }
        : i === to ? { ...s, items: [...s.items, item] }
          : s
    ));
  }
  const unit = item.qty ? item.cost / item.qty : item.cost;
  const changed = { ...item, qty: p.qty.qty, cost: Math.round(unit * p.qty.qty) };
  return stops.map((s, i) => (i === from ? { ...s, items: s.items.map((x) => (x.key === key ? changed : x)) } : s));
}

/**
 * A trip after the list grew: each line not on it yet (no stop has it, and it
 * isn't listed as missing) goes to the stop where it costs least (`costs`:
 * agorot for its quantity, by store, only the stops that sell it), or to
 * `missing` when none does. `added` counts the lines placed either way.
 */
export function addLinesToTrip(
  stops: TripStop[],
  missing: Trip['missing'],
  adds: { item: Omit<TripItem, 'cost'>; costs: Record<number, number> }[],
): { stops: TripStop[]; missing: Trip['missing']; added: number } {
  const known = new Set([...stops.flatMap((s) => s.items.map((i) => i.key)), ...missing.map((m) => m.key)]);
  const out = stops.map((s) => ({ ...s, items: [...s.items] }));
  const miss = [...missing];
  let added = 0;
  for (const { item, costs } of adds) {
    if (known.has(item.key)) continue;
    known.add(item.key);
    added++;
    let best: TripStop | null = null;
    for (const st of out) if (costs[st.store] !== undefined && (!best || costs[st.store] < costs[best.store])) best = st;
    if (best) best.items.push({ ...item, cost: costs[best.store] });
    else miss.push({ key: item.key, name: item.name });
  }
  return { stops: out, missing: miss, added };
}

/** The deal nudge for an item, if its deal needs more than it has: "יש לך 2, להוסיף עוד אחד?". */
export function dealNudge(item: TripItem): { text: string; add: number } | null {
  if (!item.deal || item.w) return null;
  const add = item.deal.minQty - item.qty;
  return add > 0 && add <= 5 ? { text: item.deal.text, add } : null;
}
