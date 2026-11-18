// Which stores the price ingest keeps: every keep/drop rule, and nothing else.
//
// A pin keeps the stores within its walk (or inside its area); a store the
// owner included in the discovery review is kept anywhere; one they skipped is
// left out; an online store follows the chain's list (chains.ts
// keepOnlineStore); every chain keeps one priced store (the fallback); a Wolt
// venue follows woltVenueRule; a manual shop is an included review row with no
// price source. The owner's files come in as one Picks (ingest/picks.ts) and
// stores are placed by one Locator (ingest/locate.ts).

import { chainBySlug, type ChainConfig } from '../chains.ts';
import { isTargetCity } from '../cities.ts';
import { storeId } from '../collections.ts';
import type { Locator } from './locate.ts';
import type { ManualShop, Picks, Point } from './picks.ts';
import type { WoltVenueConfig } from './wolt.ts';

// ── the rules ────────────────────────────────────────────────────────────

/**
 * Whether the ingest keeps a store without placing it. An online store is not
 * location-bound: it is kept exactly when keepOnlineStore says so (a pickup
 * point in a target city, or on the chain's list). A store the owner included
 * in the discovery review is kept (in any target city, pinned or not: a far
 * store is added that way); a store in a city with no pin, or one the review
 * skipped, is dropped; the rest are placed and kept when near a pin.
 */
export function keepRule(
  s: { kind: 'physical' | 'online'; key: string; cityId: string | null; /** On the chain's onlineStores list. */ listedOnline?: boolean },
  ctx: { pinnedCities: ReadonlySet<string>; curated: ReadonlySet<string>; skipped: ReadonlySet<string> },
): 'keep' | 'drop' | 'locate' {
  if (s.kind === 'online') return s.cityId !== null || s.listedOnline ? 'keep' : 'drop';
  if (ctx.curated.has(s.key)) return 'keep';
  if (s.cityId === null || !ctx.pinnedCities.has(s.cityId) || ctx.skipped.has(s.key)) return 'drop';
  return 'locate';
}

/**
 * Whether the ingest keeps a Wolt venue (places/wolt.json). Wolt pages carry
 * no coordinates, so an unplaced venue (no discovery entry) is dropped. In a
 * city with no pin (Jerusalem, Mevaseret Zion: shops the owner named there)
 * a venue whose entry was included in the review is kept, like a curated
 * official store; in a pinned city it must be within the pin's walk.
 */
export function woltVenueRule(
  v: { cityId: string; placed: boolean; included: boolean },
  pinnedCities: ReadonlySet<string>,
): 'keep' | 'drop' | 'locate' {
  if (!v.placed) return 'drop';
  if (!pinnedCities.has(v.cityId)) return v.included ? 'keep' : 'drop';
  return 'locate';
}

// ── a chain with no store near a pin keeps one ───────────────────────────
// Every chain we ingest ends up with at least one priced store (owner's rule,
// 2026-11-18). After the keep pass, a chain with no priced store keeps its
// listed online store, else its physical store nearest any pin (straight
// line), that publishes a PriceFull: the ingest checks fallbackOrder() in
// turn.

export interface FallbackCandidate {
  key: string; // "<chainSlug>/<storeId>"
  storeId: string;
  kind: 'physical' | 'online';
  /** On the chain's onlineStores list (chains.ts). */
  listedOnline: boolean;
  /** Straight-line metres to the nearest pin in any city; null when the store can't be placed. */
  distM: number | null;
  /** In a city with a pin. */
  pinnedCity: boolean;
  /** Skipped in the discovery review: the owner said no to it. */
  skipped: boolean;
}

/**
 * Whether a chain needs its fallback store: none of the stores it kept has
 * prices — neither a PriceFull in today's listing nor prices saved from an
 * earlier run (a store that skips a day keeps yesterday's, so it still counts).
 */
export const needsFallback = (kept: { publishesToday: boolean; savedPrices: boolean }[]) =>
  !kept.some((s) => s.publishesToday || s.savedPrices);

/** The candidates in the order the ingest tries them (the first that publishes a PriceFull wins). */
export function fallbackOrder(cands: FallbackCandidate[]): string[] {
  const rank = (c: FallbackCandidate) => (c.kind === 'online' ? 0 : c.distM !== null ? 1 : c.pinnedCity ? 2 : 3);
  return cands
    .filter((c) => !c.skipped && (c.kind === 'physical' || c.listedOnline))
    .sort((a, b) => rank(a) - rank(b) || (a.distM ?? 0) - (b.distM ?? 0) || Number(a.storeId) - Number(b.storeId) || a.storeId.localeCompare(b.storeId))
    .map((c) => c.key);
}

/**
 * The saved fallback stores to keep when saved stores are selected again
 * (chains not fetched this run, --offline): each one stays while its chain
 * has no other kept store with prices; once a pin reaches a store, the
 * fallback goes.
 */
export function keepFallbacks(
  stores: { key: string; chainSlug: string; keptAs?: 'fallback'; priced: boolean }[],
  kept: ReadonlySet<string>,
): Set<string> {
  const covered = new Set(stores.filter((s) => s.priced && kept.has(s.key) && s.keptAs !== 'fallback').map((s) => s.chainSlug));
  return new Set(stores.filter((s) => s.keptAs === 'fallback' && s.priced && !covered.has(s.chainSlug)).map((s) => s.key));
}

// ── the selection stage ──────────────────────────────────────────────────

/** What selection reads of a store record (the ingest's StoreRecord fits). */
export interface SelectableStore {
  chainId: string;
  storeId: string;
  chainSlug: string;
  chainName: string;
  name: string;
  address: string;
  kind: 'physical' | 'online';
  /** Target city id; null when the store is in none. */
  cityId: string | null;
  /** The store's map point. Selection sets it; an official store's saved one is never trusted. */
  at?: Point;
  /** Kept as its chain's only store. */
  keptAs?: 'fallback';
}

/**
 * Why a store is kept. `uncached`: its address or its walk from the pin is
 * not in the cache and the run is offline, so the saved verdict stands.
 */
export type KeepReason = 'online' | 'included' | 'near-pin' | 'unplaced' | 'uncached' | 'fallback';
export type DropReason = 'online-unlisted' | 'no-city' | 'no-pin' | 'skipped' | 'outside' | 'unplaced';

export interface Kept<S> {
  store: S;
  reason: KeepReason;
  /** A line for the log, where the verdict needs explaining. */
  note?: string;
}
export interface Dropped<S> {
  store: S;
  reason: DropReason;
  note?: string;
  /** Where the store is, when selection placed it. */
  at?: Point;
}
export interface Selection<S> {
  kept: Kept<S>[];
  dropped: Dropped<S>[];
}

const REASON_LABEL: [KeepReason, string][] = [
  ['included', 'included'],
  ['near-pin', 'near a pin'],
  ['unplaced', 'not placed'],
  ['uncached', 'not in the cache'],
  ['online', 'online'],
  ['fallback', "the chain's only store"],
];

/** "3 included, 2 near a pin, 1 online" — the count per keep reason, for one log line. */
export function describeKept(kept: { reason: KeepReason }[]): string {
  const parts = REASON_LABEL.flatMap(([reason, label]) => {
    const n = kept.filter((k) => k.reason === reason).length;
    return n ? [`${n} ${label}`] : [];
  });
  return parts.join(', ') || 'none';
}

const refOf = (s: { chainSlug: string; storeId: string }) => `${s.chainSlug}/${s.storeId}`;

/** The record with its point set, or with none. */
function placedAt<S extends SelectableStore>(s: S, at: Point | null): S {
  const out = { ...s };
  if (at) out.at = at;
  else delete out.at;
  return out;
}

export interface Selector {
  /**
   * Official stores (of a Stores file, or saved records): the kept ones with
   * the reason and their map point, the dropped ones with the reason.
   */
  selectOfficial<S extends SelectableStore>(stores: S[]): Promise<Selection<S>>;
  /**
   * Saved stores of chains not fetched this run: selected again, so a changed
   * decision or pin takes effect without fetching; then each chain's saved
   * fallback stays while the chain has no other priced store (keepFallbacks).
   */
  selectSaved<S extends SelectableStore>(stores: S[], priced: (s: S) => boolean): Promise<Selection<S>>;
  /** The stores a chain may fall back on, among those selection dropped, each placed and measured. */
  fallbackCandidates<S extends SelectableStore>(dropped: Dropped<S>[]): Promise<{ cand: FallbackCandidate; store: S }[]>;
  /** The priced Wolt venues to fetch, each with its point. */
  selectWolt(): Promise<{ kept: { venue: WoltVenueConfig; at: Point }[]; dropped: { venue: WoltVenueConfig; why: string }[] }>;
  /** The neighbourhood shops with no price source. */
  selectManual(): ManualShop[];
}

export function selector(picks: Picks, locator: Locator, chainOf: (slug: string) => ChainConfig | undefined = chainBySlug): Selector {
  const { pinnedCities } = picks;
  const { matched, curated, skipped } = picks.curation();
  const listedOnline = (s: SelectableStore) => (chainOf(s.chainSlug)?.onlineStores ?? []).includes(s.storeId);
  /** A physical store's point, or null when it can't be placed (or the lookup isn't cached). */
  const pointOrNull = async (s: SelectableStore): Promise<Point | null> => {
    if (s.kind !== 'physical') return null;
    const p = await locator.pointOf(s);
    return p === 'uncached' ? null : p;
  };

  async function selectOfficial<S extends SelectableStore>(stores: S[]): Promise<Selection<S>> {
    const kept: Kept<S>[] = [];
    const dropped: Dropped<S>[] = [];
    for (const s of stores) {
      const key = refOf(s);
      // A physical store outside the target cities is no candidate, whatever the review says.
      if (s.kind === 'physical' && s.cityId === null) {
        dropped.push({ store: s, reason: 'no-city' });
        continue;
      }
      const rule = keepRule({ kind: s.kind, key, cityId: s.cityId, listedOnline: listedOnline(s) }, { pinnedCities, curated, skipped });
      if (s.kind === 'online') {
        if (rule === 'keep') kept.push({ store: placedAt(s, null), reason: 'online' });
        else dropped.push({ store: s, reason: 'online-unlisted' });
        continue;
      }
      if (rule === 'keep') {
        kept.push({ store: placedAt(s, matched.get(key) ?? null), reason: 'included' });
        continue;
      }
      if (rule === 'drop') {
        dropped.push({ store: s, reason: s.cityId !== null && pinnedCities.has(s.cityId) ? 'skipped' : 'no-pin' });
        continue;
      }
      const label = `${s.chainSlug} store ${s.storeId} (${s.name} / ${s.address})`;
      const at = await locator.pointOf(s);
      if (at === 'uncached') {
        kept.push({ store: placedAt(s, null), reason: 'uncached', note: `${label}: its address lookup is not in the cache; kept as saved` });
        continue;
      }
      if (!at) {
        // Under a walk limit a store that can't be placed can't be shown to meet it.
        const strict = picks.pins.some((p) => p.city === s.cityId && p.walkMinutes);
        const note = `${label}: can't place it (tried ${locator.queriesOf(s).map((q) => `"${q}"`).join(', ') || 'nothing'}); ${strict ? 'left out' : 'kept'}`;
        if (strict) dropped.push({ store: s, reason: 'unplaced', note });
        else kept.push({ store: placedAt(s, null), reason: 'unplaced', note });
        continue;
      }
      const near = await locator.near(s.cityId, at);
      if (near === 'uncached') kept.push({ store: placedAt(s, at), reason: 'uncached', note: `${label}: its walk from the pin is not in the cache; kept as saved` });
      else if (near) kept.push({ store: placedAt(s, at), reason: 'near-pin' });
      else dropped.push({ store: s, reason: 'outside', at });
    }
    return { kept, dropped };
  }

  async function selectSaved<S extends SelectableStore>(stores: S[], priced: (s: S) => boolean): Promise<Selection<S>> {
    const sel = await selectOfficial(stores);
    const keptById = new Map(sel.kept.map((k) => [storeId(k.store), k]));
    const droppedById = new Map(sel.dropped.map((d) => [storeId(d.store), d]));
    // An online store that left the chain's list is gone, fallback or not.
    const candidates = stores.filter((s) => droppedById.get(storeId(s))?.reason !== 'online-unlisted');
    const fallbacks = keepFallbacks(
      candidates.map((s) => ({ key: storeId(s), chainSlug: s.chainSlug, keptAs: s.keptAs, priced: priced(s) })),
      new Set(keptById.keys()),
    );
    const out: Selection<S> = { kept: [], dropped: [] };
    for (const s of stores) {
      const id = storeId(s);
      const k = keptById.get(id);
      const d = droppedById.get(id);
      if (fallbacks.has(id)) {
        // Placed like any other store: the app sorts by distance from where the user is.
        const store = k ? k.store : placedAt(s, d?.at ?? (d?.reason === 'unplaced' ? null : await pointOrNull(s)));
        out.kept.push({ store, reason: 'fallback' });
      } else if (k) out.kept.push(k);
      else if (d) out.dropped.push(d);
    }
    return out;
  }

  async function fallbackCandidates<S extends SelectableStore>(dropped: Dropped<S>[]): Promise<{ cand: FallbackCandidate; store: S }[]> {
    const out: { cand: FallbackCandidate; store: S }[] = [];
    for (const d of dropped) {
      // Not candidates: a store outside the target cities, an online store off the chain's list.
      if (d.reason === 'no-city' || d.reason === 'online-unlisted') continue;
      const s = d.store;
      const at = d.at ?? (d.reason === 'unplaced' ? null : await pointOrNull(s));
      out.push({
        cand: {
          key: refOf(s), storeId: s.storeId, kind: s.kind, listedOnline: listedOnline(s), distM: at ? locator.nearestPinM(at) : null,
          pinnedCity: s.cityId !== null && pinnedCities.has(s.cityId), skipped: skipped.has(refOf(s)),
        },
        store: placedAt(s, at),
      });
    }
    return out;
  }

  async function selectWolt() {
    const kept: { venue: WoltVenueConfig; at: Point }[] = [];
    const dropped: { venue: WoltVenueConfig; why: string }[] = [];
    for (const venue of picks.woltVenues.filter((v) => isTargetCity(v.cityId) && !v.photosOnly)) {
      // Wolt pages carry no coordinates; a venue is placed by the discovery entry it was approved from.
      const at = venue.placeId ? picks.placePoint(venue.placeId) : undefined;
      const rule = woltVenueRule({ cityId: venue.cityId, placed: !!at, included: !!venue.placeId && picks.included(venue.placeId) }, pinnedCities);
      // Venues are only selected on a run that fetches them, so the walk is never 'uncached' here.
      if (at && (rule === 'keep' || (rule === 'locate' && (await locator.near(venue.cityId, at)) !== false))) kept.push({ venue, at });
      else dropped.push({ venue, why: !at ? 'no discovery entry to place it' : pinnedCities.has(venue.cityId) ? 'outside the pin' : 'not included in the review' });
    }
    return { kept, dropped };
  }

  return { selectOfficial, selectSaved, fallbackCandidates, selectWolt, selectManual: () => picks.manualShops() };
}
