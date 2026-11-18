// Atlas Search for product search: the index on shoppingItems and the query
// the search route runs against it. Import-free (node --test, and the
// `npm run shopping:search-index` script that creates the index).
//
// Atlas only: Docker Mongo has no $search, so findItems falls back to the
// regex search (searchPatterns in search-rank.ts) when this throws.

export const ITEMS_SEARCH_INDEX = 'items_search';

const text = { type: 'string', analyzer: 'lucene.standard' } as const;
const prefix = {
  type: 'autocomplete',
  analyzer: 'lucene.standard',
  tokenization: 'edgeGram',
  minGrams: 2,
  maxGrams: 12,
  foldDiacritics: true,
} as const;

/** name (n), maker (m) and every chain's other names and makers (s), each as words and as prefixes. */
export const ITEMS_SEARCH_DEFINITION = {
  mappings: {
    dynamic: false,
    fields: { n: [text, prefix], m: [text, prefix], s: [text, prefix] },
  },
} as const;

/** Candidates taken from $search before the route's own ranking. */
export const SEARCH_CANDIDATES = 100;

/**
 * The $search stage for a word query: every word must match (in the name,
 * maker or other names) as a prefix with one typo allowed, or as a whole
 * word with one or two typos. The text clause has prefixLength 0 so "מים"
 * also matches "במים" (Hebrew attaches ב/ה/ו/ל/מ/ש to the word).
 */
export function searchStage(q: string): Record<string, unknown> | null {
  const words = q.split(/\s+/).map((w) => w.trim()).filter(Boolean).slice(0, 5);
  if (!words.length) return null;
  const fuzzyPrefix = { maxEdits: 1, prefixLength: 1 };
  return {
    $search: {
      index: ITEMS_SEARCH_INDEX,
      compound: {
        must: words.map((w) => ({
          compound: {
            should: [
              { autocomplete: { query: w, path: 'n', fuzzy: fuzzyPrefix } },
              { autocomplete: { query: w, path: 'm', fuzzy: fuzzyPrefix } },
              { autocomplete: { query: w, path: 's', fuzzy: fuzzyPrefix } },
              { text: { query: w, path: ['n', 'm', 's'], fuzzy: { maxEdits: w.length > 4 ? 2 : 1, prefixLength: 0 } } },
            ],
          },
        })),
      },
    },
  };
}
