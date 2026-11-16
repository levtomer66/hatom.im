// Ranking of product-search hits. Import-free (node --test).
//
// Every hit already contains every term somewhere in its name (the Mongo
// filter guarantees it); what's left is *where*. "ביצים" should bring eggs,
// not "אטריות ביצים" or "סלט ביצים", even though the noodles are sold in more
// stores. So the name match comes first and popularity only breaks ties.

/** Letters of any script: a term preceded by one is mid-word. */
const LETTER = '\\p{L}';

/**
 * How well `name` matches the search terms (already regex-escaped, as
 * `searchTerms()` returns them). Per term: at the very start of the name
 * (leading digits like "12ביצים" don't count) 4, at the start of a later
 * word 2, inside a word 0; plus 1 when the term is a whole word (not "חלב"
 * inside "חלבה").
 */
export function matchScore(name: string, terms: string[]): number {
  let score = 0;
  for (const t of terms) {
    let start: RegExp, word: RegExp, whole: RegExp;
    try {
      start = new RegExp(`^[\\d\\s.,]*${t}`, 'iu');
      word = new RegExp(`(?:^|[^${LETTER}])${t}`, 'iu');
      whole = new RegExp(`(?:^|[^${LETTER}])${t}(?:$|[^${LETTER}])`, 'iu');
    } catch {
      continue;
    }
    if (start.test(name)) score += 4;
    else if (word.test(name)) score += 2;
    if (whole.test(name)) score += 1;
  }
  return score;
}

export interface Rankable {
  name: string;
  /** Stores in the city that sell it. */
  stores: number;
}

/**
 * Sorted copy of `hits`: sold in the city before not sold at all, then by
 * match score, then by how many stores sell it, then shorter names.
 */
export function rankHits<T extends Rankable>(hits: T[], terms: string[]): T[] {
  const scored = hits.map((h) => ({ h, s: matchScore(h.name, terms) }));
  scored.sort(
    (a, b) =>
      Number(b.h.stores > 0) - Number(a.h.stores > 0) ||
      b.s - a.s ||
      b.h.stores - a.h.stores ||
      a.h.name.length - b.h.name.length,
  );
  return scored.map((x) => x.h);
}
