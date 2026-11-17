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
  city: string;
  stops: TripStop[];
  /** Items no stop sells, kept so the checklist can mention them. */
  missing: { key: string; name: string }[];
  /** Sum of the stops' costs when the trip started, agorot. */
  estimate: number;
  /** Item keys ticked so far (anyone on the trip). */
  ticked: string[];
  startedBy: string;
  startedAt: string;
  endedAt: string | null;
  /** What was actually paid, agorot, if given at the end. */
  paid: number | null;
}

export type TripCreate = Pick<Trip, 'listId' | 'plan' | 'city' | 'stops' | 'missing' | 'estimate'>;

export type TripPatch =
  | { tick: { key: string; on: boolean } }
  | { end: { paid: number | null } };

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
  return { key: r.key, name: r.name, qty: r.qty, w: r.w === true, cost: r.cost, d, img };
}

export function parseTripCreate(body: unknown): Result<TripCreate> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be an object' };
  const b = body as Record<string, unknown>;
  if (!isStr(b.listId, 40)) return { ok: false, error: 'listId is required' };
  if (b.plan !== 'cheapest' && b.plan !== 'one-store') return { ok: false, error: 'plan must be cheapest or one-store' };
  if (!isStr(b.city, 40)) return { ok: false, error: 'city is required' };
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
  return { ok: true, value: { listId: b.listId, plan: b.plan, city: b.city, stops, missing, estimate: b.estimate } };
}

export function parseTripPatch(body: unknown): Result<TripPatch> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be an object' };
  const b = body as Record<string, unknown>;
  if (b.tick && typeof b.tick === 'object') {
    const t = b.tick as Record<string, unknown>;
    if (!isStr(t.key, 60) || typeof t.on !== 'boolean') return { ok: false, error: 'tick needs key and on' };
    return { ok: true, value: { tick: { key: t.key, on: t.on } } };
  }
  if (b.end && typeof b.end === 'object') {
    const paid = (b.end as Record<string, unknown>).paid;
    if (paid !== null && paid !== undefined && !isAgorot(paid)) return { ok: false, error: 'paid must be agorot or null' };
    return { ok: true, value: { end: { paid: (paid as number | undefined) ?? null } } };
  }
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
export function progress(trip: Pick<Trip, 'stops' | 'ticked' | 'estimate'>): { done: number; total: number; count: number; of: number } {
  const ticked = new Set(trip.ticked);
  const all = trip.stops.flatMap((s) => s.items);
  return {
    done: all.filter((i) => ticked.has(i.key)).reduce((s, i) => s + i.cost, 0),
    total: trip.estimate,
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
