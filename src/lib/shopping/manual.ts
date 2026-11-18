// Manual prices: what people typed for a shop with no price source
// (stores whose source is 'manual'). One doc per (store, item) in
// shoppingManualPrices, written by the app. Import-free (node --test).

/** ₪1,000 — anything above is a typo. */
export const MAX_MANUAL_PRICE = 100_000;

export interface ManualPrice {
  /** Store key (`k` of the store doc). */
  s: number;
  /** Item key (barcode or chain-internal key). */
  i: string;
  /** Agorot; for a weighted item, per kg. */
  p: number;
  by: string;
  at: string;
}

export interface ManualPriceInput {
  store: number;
  item: string;
  /** Agorot, or null to clear the price. */
  price: number | null;
}

export const manualPriceId = (store: number, item: string) => `${store}|${item}`;

export function parseManualPrice(body: unknown): ManualPriceInput | string {
  if (!body || typeof body !== 'object') return 'body must be an object';
  const b = body as Record<string, unknown>;
  if (!Number.isInteger(b.store) || (b.store as number) <= 0) return 'store must be a store key';
  if (typeof b.item !== 'string' || !b.item || b.item.length > 60) return 'item must be an item key';
  if (b.price === null) return { store: b.store as number, item: b.item, price: null };
  if (!Number.isInteger(b.price) || (b.price as number) <= 0 || (b.price as number) > MAX_MANUAL_PRICE) {
    return `price must be whole agorot between 1 and ${MAX_MANUAL_PRICE}, or null`;
  }
  return { store: b.store as number, item: b.item, price: b.price as number };
}

/**
 * The catalog items with typed prices added to their store→price maps, so
 * pricing treats a manual store like any other. Maps are copied, never mutated.
 * A price for an item not in `items` is ignored.
 */
export function withManualPrices<T extends { p: Record<string, number> }>(
  items: Map<string, T>,
  prices: Pick<ManualPrice, 's' | 'i' | 'p'>[],
): Map<string, T> {
  if (!prices.length) return items;
  const out = new Map(items);
  for (const m of prices) {
    const it = out.get(m.i);
    if (!it) continue;
    out.set(m.i, { ...it, p: { ...it.p, [m.s]: m.p } });
  }
  return out;
}
