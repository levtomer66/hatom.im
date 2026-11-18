// Wolt venue assortments → the same CanonItem shape the price files produce.
// Wolt is an additional price source for shops that publish no price files:
// these are Wolt's delivery prices, usually above the shelf price.
//
// Data comes from the endpoints Wolt's own web app calls:
//   consumer-api.wolt.com/order-xp/web/v1/pages/venue/slug/<slug>/static         venue name/address
//   consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/<slug>/assortment
//       → the category tree (items load per category)
//   …/assortment/categories/slug/<categorySlug>[?page_token=…]                    a category's items
//
// Only relative imports (node --test).

import { WOLT_CHAIN_ID } from './collections.ts';
import { isValidGtin, type CanonItem } from './normalize.ts';

/** The fields of a Wolt assortment item this parser reads. */
export interface WoltItem {
  id: string;
  name: string;
  /** Agorot; for sell-by-weight items, the price of `grams_per_step`. */
  price: number;
  original_price?: number | null;
  barcode_gtin?: string | null;
  unit_info?: string | null;
  sell_by_weight_config?: { price_per_kg?: number | null } | null;
  disabled_info?: unknown;
  images?: { url?: string }[];
  /** Set by the fetcher, not Wolt: the item's category path ("פירות וירקות / ירקות"). */
  category?: string;
}

export interface WoltCategory {
  slug: string;
  name: string;
  subcategories?: WoltCategory[];
}

/** Leaf categories (a parent lists no items of its own), each with its name path from the top. */
export function leafCategories(categories: WoltCategory[]): { slug: string; path: string }[] {
  const out = new Map<string, string>();
  const walk = (c: WoltCategory, parents: string[]) => {
    const path = [...parents, c.name.trim()];
    if (c.subcategories?.length) c.subcategories.forEach((s) => walk(s, path));
    else if (!out.has(c.slug)) out.set(c.slug, path.join(' / '));
  };
  categories.forEach((c) => walk(c, []));
  return [...out].map(([slug, path]) => ({ slug, path }));
}

/** Slugs whose items must be fetched: leaf categories. */
export const leafCategorySlugs = (categories: WoltCategory[]): string[] => leafCategories(categories).map((c) => c.slug);

/** "07290000497044" → "7290000497044": Wolt sends GTIN-14 with a leading zero. */
export function woltBarcode(gtin: string | null | undefined): string | null {
  const digits = (gtin ?? '').trim().replace(/^0+(?=\d{8,})/, '');
  return isValidGtin(digits) ? digits : null;
}

const UNITS: Record<string, string> = { g: 'גרם', gr: 'גרם', kg: 'ק"ג', ml: 'מ"ל', l: 'ליטר', cl: 'ס"ל', pcs: 'יחידות', pc: 'יחידות' };

/** "750 g" → { quantity: 750, unitQty: "גרם" }. */
export function parseUnitInfo(s: string | null | undefined): { quantity: number | null; unitQty: string } {
  const m = /^\s*([\d.,]+)\s*([a-z]+)\s*$/i.exec(s ?? '');
  if (!m) return { quantity: null, unitQty: '' };
  return { quantity: Number(m[1].replace(',', '.')), unitQty: UNITS[m[2].toLowerCase()] ?? m[2] };
}

/** The item's photo, as a link only (Wolt's image proxy takes ?w=<px> for a thumbnail). */
export function woltImage(it: Pick<WoltItem, 'images'>): string | undefined {
  const url = it.images?.find((i) => i.url)?.url;
  return url && /^https:\/\//.test(url) ? url : undefined;
}

/**
 * One venue's items. Unavailable items are dropped; items without a barcode
 * (produce, deli counter) are keyed per venue so they never cross-match.
 * Weighted items are priced per kg, like `bIsWeighted` items in the price files.
 */
export function woltItems(venueSlug: string, items: WoltItem[]): CanonItem[] {
  const out = new Map<string, CanonItem>();
  for (const it of items) {
    if (it.disabled_info) continue;
    const perKg = it.sell_by_weight_config?.price_per_kg ?? null;
    const priceAgorot = perKg ?? it.price;
    if (!Number.isFinite(priceAgorot) || priceAgorot <= 0) continue;
    const barcode = woltBarcode(it.barcode_gtin);
    const code = barcode ?? `${venueSlug}/${it.id}`;
    const { quantity, unitQty } = parseUnitInfo(it.unit_info);
    out.set(barcode ?? `${WOLT_CHAIN_ID}:${code}`, {
      key: barcode ?? `${WOLT_CHAIN_ID}:${code}`,
      code,
      barcode: barcode !== null,
      name: it.name.replace(/[‎‏‪-‮]/g, '').trim(),
      manufacturer: '',
      unitQty: perKg !== null ? 'ק"ג' : unitQty,
      quantity: perKg !== null ? 1 : quantity,
      unitOfMeasure: perKg !== null ? 'ק"ג' : it.unit_info ?? '',
      weighted: perKg !== null,
      priceAgorot,
      ...(woltImage(it) ? { img: woltImage(it) } : {}),
      ...(it.category ? { category: it.category } : {}),
    });
  }
  return [...out.values()];
}
