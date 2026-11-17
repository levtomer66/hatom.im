// Shopping plans: how to buy a list. Import-free (node --test).
//
// Two plans sit on top of the comparison (docs/shopping-in-store-mode.md):
// - "one store": the best single store for the whole list (rankStores' first);
// - "cheapest": each item at its cheapest store, using at most MAX_PLAN_STORES
//   stores. It's only worth the extra walking when it saves SPLIT_MIN_SAVING.
//
// choosePlan works on the per-line costs of baskets priced for the whole
// list, so it can pick stores quickly; the route then re-prices each stop on
// its own lines (a mix & match deal may not survive the split) for the real
// totals.

/** Most stores in a "cheapest" plan. */
export const MAX_PLAN_STORES = 3;
/** A split must save at least this much (agorot) over the best single store. */
export const SPLIT_MIN_SAVING = 1500;
/** Only the best stores are tried in combinations (C(20,3) = 1140 sets). */
const CANDIDATES = 20;

export interface PlanBasket {
  store: number;
  lines: { key: string; available: boolean; cost: number }[];
}

export interface PlanChoice {
  /** item key → store it's bought at; items no chosen store sells are missing. */
  assign: Record<string, number>;
  stores: number[];
  missing: string[];
  /** Sum of the per-line costs used to choose (before re-pricing). */
  estimate: number;
}

function combos<T>(xs: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, acc: T[]) => {
    if (acc.length === k) return void out.push([...acc]);
    for (let i = start; i < xs.length; i++) pick(i + 1, [...acc, xs[i]]);
  };
  pick(0, []);
  return out;
}

/**
 * The best way to buy `keys` from at most `maxStores` of `baskets`: fewest
 * missing items first, then the lowest total. Stores that end up buying
 * nothing are dropped. Null when no store sells anything.
 */
export function choosePlan(baskets: PlanBasket[], keys: string[], maxStores = MAX_PLAN_STORES): PlanChoice | null {
  const cost = new Map<number, Map<string, number>>();
  for (const b of baskets) {
    const m = new Map<string, number>();
    for (const l of b.lines) if (l.available) m.set(l.key, l.cost);
    if (m.size) cost.set(b.store, m);
  }
  // The stores that cover most of the list most cheaply are the ones worth combining.
  const ranked = [...cost.keys()].sort((a, b) => {
    const ma = cost.get(a)!, mb = cost.get(b)!;
    const sum = (m: Map<string, number>) => [...m.values()].reduce((s, c) => s + c, 0);
    return mb.size - ma.size || sum(ma) - sum(mb);
  });
  const cands = ranked.slice(0, CANDIDATES);
  let best: PlanChoice | null = null;
  for (let k = 1; k <= Math.min(maxStores, cands.length); k++) {
    for (const set of combos(cands, k)) {
      const assign: Record<string, number> = {};
      const missing: string[] = [];
      let estimate = 0;
      for (const key of keys) {
        let at: number | null = null;
        let c = Infinity;
        for (const s of set) {
          const v = cost.get(s)!.get(key);
          if (v !== undefined && v < c) [at, c] = [s, v];
        }
        if (at === null) missing.push(key);
        else {
          assign[key] = at;
          estimate += c;
        }
      }
      const stores = set.filter((s) => Object.values(assign).includes(s));
      const better = !best
        || missing.length < best.missing.length
        || (missing.length === best.missing.length && estimate < best.estimate)
        || (missing.length === best.missing.length && estimate === best.estimate && stores.length < best.stores.length);
      if (better) best = { assign, stores, missing, estimate };
    }
  }
  return best;
}

/** Is a split worth it next to the best single store? Both totals in agorot, same missing count. */
export const splitPays = (splitTotal: number, oneStoreTotal: number, minSaving = SPLIT_MIN_SAVING) =>
  oneStoreTotal - splitTotal >= minSaving;

/**
 * How many stores are worth walking to, given the best plan for each count
 * (ascending, the one-store plan first). Each extra store must cover more
 * items or save `minSaving` over the last count taken; otherwise the
 * shopper stays with fewer stores. 1 when there's nothing to choose from.
 */
export function worthCount(
  options: { count: number; total: number; missing: number }[],
  minSaving = SPLIT_MIN_SAVING,
): number {
  let cur = options[0];
  if (!cur) return 1;
  for (const o of options.slice(1)) {
    if (o.missing < cur.missing || (o.missing === cur.missing && cur.total - o.total >= minSaving)) cur = o;
  }
  return cur.count;
}
