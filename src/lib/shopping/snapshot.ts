// Turns the latest parsed state of every store into the Mongo documents the
// app reads, and diffs them against what was last written.
//
// Why this shape (Atlas M0: 512 MB incl. indexes, ~100 ops/s):
// - one doc per *item* holding a {storeKey: agorot} map → a basket is a single
//   `_id: {$in}` read, and ~3M (store,item) prices cost ~30 MB, not ~400 MB;
// - the ingest job rebuilds the whole snapshot locally each run and writes
//   only docs whose content hash changed, so a daily run is thousands of
//   writes, not millions.
// Import-free (node built-ins only).

import { createHash } from 'node:crypto';
import { parseFileName, type CanonItem, type CanonPromo, type CanonPromoGroup, type CanonStore } from './normalize.ts';
import { departmentOf, departmentOfCategory } from './departments.ts';
import { photoByName } from './photos.ts';
import { priceSourceOf, storeId, type PriceSource, type StoreId } from './collections.ts';

export interface StoreState {
  /** Short numeric store key used inside the price maps. */
  k: number;
  chainId: string;
  storeId: string;
  items: CanonItem[];
  promos: CanonPromo[];
}

export interface ItemDoc {
  _id: string; // barcode, or "<chainId>:<code>"
  n: string; // name
  m: string; // manufacturer
  uq: string; // unit (e.g. גרם)
  q: number | null; // quantity in units
  um: string; // unit of measure for per-unit price (e.g. 100 גרם)
  w: boolean; // sold by weight
  bc: boolean; // real barcode (cross-chain)
  p: Record<string, number>; // storeKey → price in agorot
  img?: string; // product photo link (omitted when no source has one)
  /** Search text: the other chains' names and makers, " | "-joined (omitted when nothing adds to n/m). */
  s?: string;
  /** Store department (departments.ts), omitted when nothing places it. */
  d?: string;
  /** 'name' when `img` is borrowed from the same product under another code (photos.ts) — an illustration. */
  imgBy?: 'name';
}

export interface PromoGroupDoc {
  gid: string;
  rt: number | null; // RewardType as published (chain-specific meaning)
  min: number; // MinQty
  max: number | null;
  rate: number | null; // percent
  price: number | null; // agorot, total for `min` units
  w: boolean;
  items: string[];
}

export interface PromoDoc {
  /** "<chainId>:<promotionId>:<variant>" — see buildPromoDocs. */
  _id: string;
  pid: string; // PromotionID as published
  chain: string;
  d: string; // description
  s: string; // start, Israel local "YYYY-MM-DDTHH:mm"
  e: string; // end
  club: number; // 0 = everyone
  clubName: string;
  coupon: boolean;
  minAmt: number | null; // agorot, basket minimum
  limit: number | null; // redemption limit, null = unlimited
  minItems: number | null; // MinNoOfItemOffered as published
  remarks: string;
  g: PromoGroupDoc[];
  /** Every item key in any group — the multikey index the basket query uses. */
  items: string[];
  stores: number[];
}

/** Makers that say nothing: "לא ידוע", dashes, "כללי", … (compared after trimming). */
const PLACEHOLDER_MAKER = /^(|-+|\.+|0|לא ידוע|לא מוגדר|ללא|כללי|כללית|שונות|אחר|unknown|n\/a|none|general)$/i;
export const realMaker = (m: string) => !PLACEHOLDER_MAKER.test(m.trim());
const SEARCH_TEXT_MAX = 400;
const tidy = (v: string) => v.replace(/\s+/g, ' ').trim();

/**
 * Every distinct name and real maker the chains publish for an item, except
 * the doc's own n/m — sorted, so the text (and the doc hash) is stable.
 */
function searchText(n: string, m: string, names: string[], makers: string[]): string {
  const seen = new Set([n, m].map((v) => tidy(v).toLowerCase()));
  const out: string[] = [];
  for (const v of [...names, ...makers.filter(realMaker)].map(tidy).sort()) {
    const k = v.toLowerCase();
    if (!v || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out.join(' | ').slice(0, SEARCH_TEXT_MAX);
}

/**
 * A source's own category wins (Wolt's, voted across venues), then the item's
 * most common name, then any other chain's name — the first that a rule places.
 */
function itemDepartment(cats: string[], n: string, names: string[]): string | null {
  const fromCats = mostCommon(cats.map((c) => departmentOfCategory(c) ?? ''));
  if (fromCats) return fromCats;
  const direct = departmentOf(n);
  if (direct) return direct;
  return mostCommon(names.map((x) => departmentOf(x) ?? '')) || null;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = '';
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN || (n === bestN && v.length > best.length)) [best, bestN] = [v, n];
  return best;
}

export function buildItemDocs(stores: StoreState[]): Map<string, ItemDoc> {
  const acc = new Map<string, { names: string[]; makers: string[]; cats: string[]; first: CanonItem; p: Record<string, number>; img?: string }>();
  for (const s of stores) {
    for (const it of s.items) {
      let a = acc.get(it.key);
      if (!a) acc.set(it.key, (a = { names: [], makers: [], cats: [], first: it, p: {} }));
      a.names.push(it.name);
      a.makers.push(it.manufacturer);
      if (it.category) a.cats.push(it.category);
      // The smallest link wins, so the choice doesn't flip between runs (and rewrite the doc).
      if (it.img && (!a.img || it.img < a.img)) a.img = it.img;
      a.p[String(s.k)] = it.priceAgorot;
    }
  }
  const out = new Map<string, ItemDoc>();
  for (const [key, a] of acc) {
    const n = mostCommon(a.names);
    // The most common real maker; a placeholder only when no chain names one.
    const m = mostCommon(a.makers.map(tidy).filter(realMaker)) || a.first.manufacturer;
    const s = searchText(n, m, a.names, a.makers);
    const d = itemDepartment(a.cats, n, a.names);
    out.set(key, {
      _id: key,
      n,
      m,
      uq: a.first.unitQty,
      q: a.first.quantity,
      um: a.first.unitOfMeasure,
      w: a.first.weighted,
      bc: a.first.barcode,
      p: a.p,
      ...(a.img ? { img: a.img } : {}),
      ...(s ? { s } : {}),
      ...(d ? { d } : {}),
    });
  }
  // Items no source photographs borrow a photo from the same product under another code.
  const borrowed = photoByName([...out.values()].map((d) => ({ key: d._id, name: d.n, d: d.d, img: d.img })));
  for (const [key, img] of borrowed) Object.assign(out.get(key)!, { img, imgBy: 'name' as const });
  return out;
}

type PartTerms = Omit<PromoGroupDoc, 'items'>;

/**
 * The price-file key for an item a promo file lists. The two files key items
 * independently, and they disagree: Shufersal's PromoFull leaves ItemType
 * empty on most items, so a barcode can come out chain-scoped in one file and
 * bare in the other. The price file's key wins.
 */
function resolveKey(listed: string, chainId: string, price: Map<string, number>): string | null {
  if (price.has(listed)) return listed;
  const prefix = `${chainId}:`;
  const alt = listed.startsWith(prefix) ? listed.slice(prefix.length) : prefix + listed;
  return price.has(alt) ? alt : null;
}

/**
 * A percent deal's published price, when it is just the rate applied to this
 * store's regular price (±1 agora), carries no information — and it differs
 * per store, which would split one chain-wide deal into a doc per store.
 */
function derivedFromRate(g: CanonPromoGroup, regular: number): boolean {
  const r = g.discountRate;
  if (r === null || r <= 0 || r >= 100 || g.discountedPriceAgorot === null || g.minQty > 1) return false;
  return Math.abs(g.discountedPriceAgorot - regular * (1 - r / 100)) <= 1.01;
}

/** Whether a promo item carries an actual numeric discount at this store. */
function isNumericDeal(t: PartTerms, regular: number): boolean {
  if (t.rate !== null && t.rate > 0) return true;
  return t.price !== null && t.price < Math.round(regular * Math.max(t.min, 1));
}

export interface PromoBuildStats {
  /** Coupons with no numeric discount (e.g. meal-voucher gift coupons on every item). */
  droppedCoupons: number;
}

/**
 * One doc per (chain, PromotionID, terms), listing the stores that carry
 * those terms.
 *
 * The same PromotionID isn't byte-identical across stores: each store's file
 * lists its own item set (Shufersal lists chain-wide items a store doesn't
 * sell), and percent deals publish a per-store DiscountedPrice. Measured on
 * 60 stores (2026-11-15): a store never omits an item it sells that another
 * store's copy includes, so item lists are only filtered to sold items and
 * then *unioned* across stores with equal terms. Rate-derived prices are
 * dropped (pricing recomputes them from the rate), so they don't split terms.
 *
 * Promotions already over at `nowLocal` (Israel local "YYYY-MM-DDTHH:mm") are
 * dropped — they can never apply again.
 */
export function buildPromoDocs(
  stores: StoreState[],
  nowLocal: string,
  stats: PromoBuildStats = { droppedCoupons: 0 },
): Map<string, PromoDoc> {
  const acc = new Map<string, { doc: PromoDoc; parts: Map<string, { t: PartTerms; items: Set<string> }> }>();
  for (const s of stores) {
    const price = new Map(s.items.map((i) => [i.key, i.priceAgorot]));
    for (const p of s.promos) {
      if (p.end < nowLocal) continue;
      const parts = new Map<string, { t: PartTerms; items: string[] }>();
      let numeric = false;
      for (const g of p.groups) {
        for (const listed of g.items) {
          const key = resolveKey(listed, p.chainId, price);
          if (key === null) continue; // the store doesn't sell it
          const regular = price.get(key)!;
          const t: PartTerms = {
            gid: g.groupId,
            rt: g.rewardType,
            min: g.minQty,
            max: g.maxQty,
            rate: g.discountRate,
            price: derivedFromRate(g, regular) ? null : g.discountedPriceAgorot,
            w: g.weighted,
          };
          numeric ||= isNumericDeal(t, regular);
          const sig = stableStringify(t);
          const part = parts.get(sig) ?? { t, items: [] };
          part.items.push(key);
          parts.set(sig, part);
        }
      }
      if (!parts.size) continue;
      if (p.isCoupon && !numeric) {
        stats.droppedCoupons++;
        continue;
      }
      const sigs = [...parts.keys()].sort();
      const terms = {
        d: p.description, s: p.start, e: p.end, club: p.clubId, coupon: p.isCoupon,
        minAmt: p.minPurchaseAgorot, limit: p.redemptionLimit, g: sigs,
      };
      const id = `${p.chainId}:${p.promotionId}:${docHash(terms).slice(0, 8)}`;
      let entry = acc.get(id);
      if (!entry) {
        entry = {
          doc: {
            _id: id,
            pid: p.promotionId,
            chain: p.chainId,
            d: p.description,
            s: p.start,
            e: p.end,
            club: p.clubId,
            clubName: p.clubName,
            coupon: p.isCoupon,
            minAmt: p.minPurchaseAgorot,
            limit: p.redemptionLimit,
            minItems: p.minItemsOffered,
            remarks: p.remarks,
            g: [],
            items: [],
            stores: [],
          },
          parts: new Map(sigs.map((sig) => [sig, { t: parts.get(sig)!.t, items: new Set<string>() }])),
        };
        acc.set(id, entry);
      }
      for (const [sig, part] of parts) for (const k of part.items) entry.parts.get(sig)!.items.add(k);
      if (!entry.doc.stores.includes(s.k)) entry.doc.stores.push(s.k);
    }
  }
  const out = new Map<string, PromoDoc>();
  for (const [id, { doc, parts }] of acc) {
    doc.g = [...parts.values()].map(({ t, items }) => ({ ...t, items: [...items].sort() }));
    doc.items = [...new Set(doc.g.flatMap((x) => x.items))].sort();
    doc.stores.sort((a, b) => a - b);
    out.set(id, doc);
  }
  return out;
}

export interface StoreDoc {
  _id: StoreId;
  k: number;
  chainId: string;
  chainSlug: string;
  chainName: string;
  storeId: string;
  name: string;
  address: string;
  /** Target city id, or null for an online store outside the target cities. */
  city: string | null;
  cityRaw: string;
  kind: CanonStore['kind'];
  priceFile: string | null;
  promoFile: string | null;
  /** When the prices / promos were published (Israel local "YYYY-MM-DDTHH:mm", from the file name). */
  pricesAt: string | null;
  promosAt: string | null;
  source: PriceSource;
  /** Routed walking minutes from the nearest pin (physical stores; null when unknown or online). */
  walkMin: number | null;
}

export interface StoreInput extends CanonStore {
  chainSlug: string;
  chainName: string;
  cityId: string | null;
  priceFile: string | null;
  promoFile: string | null;
  walkMin?: number | null;
}

/** "202611150040" → "2026-11-15T00:40". */
function stampToLocal(file: string | null): string | null {
  // Price files carry the stamp in their name; other sources use "<source>-…-YYYYMMDDHHmm".
  const stamp = file ? (parseFileName(file)?.stamp ?? /-(20\d{10})$/.exec(file)?.[1]) : undefined;
  if (!stamp || stamp.length < 12) return null;
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}`;
}

export function buildStoreDocs(stores: StoreInput[], keys: Record<string, number>): Map<string, StoreDoc> {
  return new Map(
    stores.map((s) => {
      const id = storeId(s);
      return [id, {
        _id: id, k: keys[id], chainId: s.chainId, chainSlug: s.chainSlug, chainName: s.chainName,
        storeId: s.storeId, name: s.name, address: s.address, city: s.cityId, cityRaw: s.city, kind: s.kind,
        priceFile: s.priceFile, promoFile: s.promoFile, pricesAt: stampToLocal(s.priceFile), promosAt: stampToLocal(s.promoFile),
        source: priceSourceOf(s.chainId),
        walkMin: s.walkMin ?? null,
      }];
    }),
  );
}

/** Key-order-independent content hash. */
export function docHash(doc: unknown): string {
  return createHash('sha1').update(stableStringify(doc)).digest('base64url');
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`;
}

export interface Diff<T> {
  upserts: T[];
  deletes: string[];
  /** The hashes to persist once the writes succeed. */
  next: Record<string, string>;
}

export function diffDocs<T extends { _id: string }>(desired: Map<string, T>, written: Record<string, string>): Diff<T> {
  const upserts: T[] = [];
  const next: Record<string, string> = {};
  for (const [id, doc] of desired) {
    const h = docHash(doc);
    next[id] = h;
    if (written[id] !== h) upserts.push(doc);
  }
  const deletes = Object.keys(written).filter((id) => !desired.has(id));
  return { upserts, deletes, next };
}

/** Israel local time as "YYYY-MM-DDTHH:mm" — the zone the files' dates are in. */
export function israelLocalNow(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
