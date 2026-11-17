// Shared list helpers: search terms, and the quantity rules re-exported from
// home.ts (the household's My items and its one list replaced named lists).
// Import-free, for `node --test`.

export { MAX_LIST_ITEMS, MAX_QTY, normalizeQty, type ListLine as ShoppingListItem } from './home.ts';

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
