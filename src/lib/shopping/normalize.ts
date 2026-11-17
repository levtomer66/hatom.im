// Canonical schema for the price-transparency files, plus the per-chain
// normalizers that map each chain's XML onto it. Import-free (except other
// import-free shopping modules) so `node --test` can load it.

import { blocks, field, leafFields } from './xml.ts';

export type StoreKind = 'physical' | 'online';

export interface CanonStore {
  chainId: string;
  storeId: string; // leading zeros stripped: "001" and "1" are the same store
  subChainId: string;
  name: string;
  address: string;
  city: string; // raw City value: a CBS code, a Hebrew name, or "0"
  kind: StoreKind;
}

export interface CanonItem {
  /** Cross-chain key: the barcode, or `<chainId>:<code>` for chain-internal codes. */
  key: string;
  code: string;
  barcode: boolean;
  name: string;
  manufacturer: string;
  unitQty: string; // e.g. "גרם"
  quantity: number | null; // e.g. 57
  unitOfMeasure: string; // e.g. "100 גרם"
  weighted: boolean;
  priceAgorot: number;
  /** Product photo link, when a source has one (Wolt does; price files never). */
  img?: string;
  /** The source's category path, when it has one (Wolt does; price files never). */
  category?: string;
}

export interface CanonPromoGroup {
  groupId: string;
  rewardType: number | null;
  minQty: number;
  maxQty: number | null;
  discountRate: number | null; // percent
  discountedPriceAgorot: number | null; // total for minQty units (see docs/sources.md)
  weighted: boolean;
  /** Item keys (same scheme as CanonItem.key). */
  items: string[];
}

export interface CanonPromo {
  chainId: string;
  promotionId: string;
  description: string;
  start: string; // Israel local time, "YYYY-MM-DDTHH:mm"
  end: string;
  clubId: number; // 0 = all customers
  clubName: string;
  isCoupon: boolean;
  minPurchaseAgorot: number | null;
  redemptionLimit: number | null; // null = unlimited (files use 0)
  /** MinNoOfItemOffered as published. 10 on ~99% of promos in both chains, so its meaning is unclear; kept for pricing to decide. */
  minItemsOffered: number | null;
  remarks: string;
  groups: CanonPromoGroup[];
}

export interface ParsedPriceFile {
  chainId: string;
  storeId: string;
  items: CanonItem[];
  skipped: number;
}

export interface ParsedPromoFile {
  chainId: string;
  storeId: string;
  promos: CanonPromo[];
  skipped: number;
}

/** Strip leading zeros; keeps "0" for an all-zero id. */
export function normStoreId(id: string): string {
  const t = id.trim().replace(/^0+/, '');
  return t === '' ? '0' : t;
}

/** GS1 check digit validation for EAN-8 / UPC-A / EAN-13 / GTIN-14. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * The item key used to match across chains. Only real GTINs cross-match;
 * ItemType 0 and internal/short codes stay scoped to their chain.
 */
export function itemKey(chainId: string, code: string, itemType: string): { key: string; barcode: boolean } {
  const c = code.trim();
  if (itemType.trim() !== '0' && isValidGtin(c)) return { key: c, barcode: true };
  return { key: `${chainId}:${c}`, barcode: false };
}

function num(s: string | undefined): number | null {
  if (s === undefined) return null;
  const t = s.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const agorot = (s: string | undefined): number | null => {
  const n = num(s);
  return n === null ? null : Math.round(n * 100);
};

/** "2026-11-20T23:59:00.000" or "2026-11-20 23:59" → "2026-11-20T23:59". */
export function normLocalDateTime(s: string): string {
  const m = /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s.trim());
  if (!m) return '';
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}`;
}

/** "0 - כלל הלקוחות" → { id: 0, name: "כלל הלקוחות" }. */
export function parseClub(s: string): { id: number; name: string } {
  const m = /^\s*(\d+)\s*(?:-\s*(.*))?$/.exec(s);
  if (!m) return { id: 0, name: s.trim() };
  return { id: Number(m[1]), name: (m[2] ?? '').trim() };
}

// ── Per-chain schemas ────────────────────────────────────────────────────
//
// Field lookups are case-insensitive already (PromotionId vs PromotionID).
// A schema lists the alias tags to try, in order, for each canonical field;
// a chain with different tag names gets its own entry in CHAIN_SCHEMAS.

export interface ChainSchema {
  item: Record<
    'code' | 'itemType' | 'name' | 'manufacturer' | 'unitQty' | 'quantity' | 'unitOfMeasure' | 'weighted' | 'price',
    string[]
  >;
}

export const DEFAULT_SCHEMA: ChainSchema = {
  item: {
    code: ['itemcode'],
    itemType: ['itemtype'],
    name: ['itemname', 'itemnm'],
    manufacturer: ['manufacturername', 'manufacturename'],
    unitQty: ['unitqty'],
    quantity: ['quantity'],
    unitOfMeasure: ['unitofmeasure'],
    weighted: ['bisweighted', 'blnisweighted'],
    price: ['itemprice'],
  },
};

/** Chains whose files deviate from the regulation tag names. Both current chains use the default. */
export const CHAIN_SCHEMAS: Record<string, ChainSchema> = {};

const schemaFor = (chainId: string) => CHAIN_SCHEMAS[chainId] ?? DEFAULT_SCHEMA;

function pick(f: Record<string, string>, aliases: string[]): string {
  for (const a of aliases) if (a in f) return f[a];
  return '';
}

function headerIds(xml: string): { chainId: string; storeId: string } {
  const head = xml.slice(0, 2000);
  return { chainId: field(head, 'ChainId'), storeId: normStoreId(field(head, 'StoreId')) };
}

export function parsePriceFile(xml: string): ParsedPriceFile {
  const { chainId, storeId } = headerIds(xml);
  const s = schemaFor(chainId).item;
  const items: CanonItem[] = [];
  let skipped = 0;
  for (const b of blocks(xml, 'Item')) {
    const f = leafFields(b);
    const code = pick(f, s.code);
    const price = agorot(pick(f, s.price));
    if (!code || price === null || price <= 0) {
      skipped++;
      continue;
    }
    const { key, barcode } = itemKey(chainId, code, pick(f, s.itemType));
    items.push({
      key,
      code,
      barcode,
      name: pick(f, s.name),
      manufacturer: pick(f, s.manufacturer),
      unitQty: pick(f, s.unitQty),
      quantity: num(pick(f, s.quantity)),
      unitOfMeasure: pick(f, s.unitOfMeasure),
      weighted: pick(f, s.weighted) === '1',
      priceAgorot: price,
    });
  }
  return { chainId, storeId, items, skipped };
}

const PROMOTION_ITEMS = /<PromotionItems>[\s\S]*?<\/PromotionItems>/gi;

export function parsePromoFile(xml: string): ParsedPromoFile {
  const { chainId, storeId } = headerIds(xml);
  const promos: CanonPromo[] = [];
  let skipped = 0;
  for (const p of blocks(xml, 'Promotion')) {
    // Promotion-level fields live outside <Groups>/<PromotionItems>.
    const outer = p.replace(PROMOTION_ITEMS, '');
    const f = leafFields(outer);
    const promotionId = f['promotionid'] ?? '';
    const end = normLocalDateTime(f['promotionenddatetime'] ?? '');
    if (!promotionId || !end) {
      skipped++;
      continue;
    }
    const groupBlocks = blocks(p, 'Group');
    const groups: CanonPromoGroup[] = [];
    for (const g of groupBlocks.length ? groupBlocks : [p]) {
      const groupId = field(g.replace(PROMOTION_ITEMS, ''), 'GroupID') || '1';
      // Split a group into uniform parts: items in one group usually share
      // their deal terms, and storing the terms once keeps the doc small.
      const parts = new Map<string, CanonPromoGroup>();
      for (const ib of blocks(g, 'PromotionItem')) {
        const it = leafFields(ib);
        const code = it['itemcode'] ?? '';
        if (!code) continue;
        const part: Omit<CanonPromoGroup, 'items'> = {
          groupId,
          rewardType: num(it['rewardtype']),
          minQty: num(it['minqty']) ?? 1,
          maxQty: num(it['maxqty']),
          discountRate: num(it['discountrate']),
          discountedPriceAgorot: agorot(it['discountedprice']),
          weighted: it['bisweighted'] === '1',
        };
        const sig = JSON.stringify(part);
        let target = parts.get(sig);
        if (!target) parts.set(sig, (target = { ...part, items: [] }));
        target.items.push(itemKey(chainId, code, it['itemtype'] ?? '').key);
      }
      groups.push(...parts.values());
    }
    if (!groups.length) {
      skipped++;
      continue;
    }
    const club = parseClub(f['clubid'] ?? '');
    const limit = num(f['redemptionlimit']);
    const minAmt = agorot(f['minpurchaseamount']);
    promos.push({
      chainId,
      promotionId,
      description: f['promotiondescription'] ?? '',
      start: normLocalDateTime(f['promotionstartdatetime'] ?? ''),
      end,
      clubId: club.id,
      clubName: club.name,
      isCoupon: f['additionaliscoupon'] === '1',
      minPurchaseAgorot: minAmt && minAmt > 0 ? minAmt : null,
      redemptionLimit: limit && limit > 0 ? limit : null,
      minItemsOffered: num(f['minnoofitemoffered']),
      remarks: f['remarks'] ?? '',
      groups,
    });
  }
  return { chainId, storeId, promos, skipped };
}

export function parseStoresFile(xml: string): { chainId: string; chainName: string; stores: CanonStore[] } {
  const head = xml.slice(0, 2000);
  const chainId = field(head, 'ChainId');
  const chainName = field(head, 'ChainName');
  const stores: CanonStore[] = [];
  const subChains = blocks(xml, 'SubChain');
  for (const sc of subChains.length ? subChains : [xml]) {
    const subChainId = field(sc.slice(0, 500), 'SubChainId');
    for (const sb of blocks(sc, 'Store')) {
      const f = leafFields(sb);
      if (!f['storeid']) continue;
      stores.push({
        chainId,
        storeId: normStoreId(f['storeid']),
        subChainId: f['subchainid'] ?? subChainId,
        name: f['storename'] ?? '',
        address: f['address'] ?? '',
        city: f['city'] ?? '',
        kind: f['storetype'] === '2' ? 'online' : 'physical',
      });
    }
  }
  return { chainId, chainName, stores };
}

export type FileType = 'Stores' | 'PriceFull' | 'Price' | 'PromoFull' | 'Promo';

export interface FileNameInfo {
  type: FileType;
  chainId: string;
  storeId: string | null;
  /** "YYYYMMDDHHmm" when parseable, for ordering. */
  stamp: string;
}

/**
 * Parse a published file name. Handles the common
 * `PriceFull<chain>-<sub>-<store>-<YYYYMMDD>-<HHMMSS>` form, the Laibcatalog
 * `…-<YYYYMMDDHHMMSS>-<HHMMSS>` form and `StoresFull…-<YYYYMMDDHHMM>`.
 */
export function parseFileName(name: string): FileNameInfo | null {
  const base = name.replace(/^.*\//, '').replace(/(\.xml|\.gz)+$/i, '');
  const m = /^(StoresFull|Stores|PriceFull|Price|PromoFull|Promo)(\d+)-(.+)$/i.exec(base);
  if (!m) return null;
  const rawType = m[1].toLowerCase();
  const type: FileType =
    rawType === 'pricefull' ? 'PriceFull'
    : rawType === 'price' ? 'Price'
    : rawType === 'promofull' ? 'PromoFull'
    : rawType === 'promo' ? 'Promo'
    : 'Stores';
  const parts = m[3].split('-');
  const digits = parts.filter((p) => /^\d+$/.test(p));
  const dateIdx = parts.findIndex((p) => /^20\d{6,12}$/.test(p));
  let stamp = '';
  if (dateIdx >= 0) {
    const d = parts[dateIdx];
    const t = d.length > 8 ? d.slice(8) : parts[dateIdx + 1] ?? '';
    stamp = (d.slice(0, 8) + t.padEnd(4, '0')).slice(0, 12);
  }
  const storeId = type === 'Stores' || dateIdx < 2 ? null : normStoreId(parts[dateIdx - 1]);
  if (!digits.length) return null;
  return { type, chainId: m[2], storeId, stamp };
}
