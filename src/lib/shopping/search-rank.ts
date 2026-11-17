// Ranking of product-search hits. Import-free (node --test).
//
// Every hit already matches every term in its name or manufacturer (the Mongo
// filter guarantees it); what's left is *where*. "ביצים" should bring eggs,
// not "אטריות ביצים" or "סלט ביצים", even though the noodles are sold in more
// stores. So the name match comes first and popularity only breaks ties.

/** Letters of any script: a term preceded by one is mid-word. */
const LETTER = '\\p{L}';

// ---- spelling-tolerant patterns -----------------------------------------
//
// Product names in the price files spell Hebrew every way: with or without
// vowel letters (פילטונה / פלטונה, שוקולד / שקולד), final or regular letter
// forms, ה or א at the end, quote marks or not (קוטג׳ / קוטג). A search term
// becomes a regex that accepts all of those. A looser "typo" pattern also
// accepts one missing or wrong letter; the route uses it only when the first
// pass finds almost nothing.

const FINAL_TO_BASE: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const BASE_TO_FINAL: Record<string, string> = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
const HEBREW = /[\u05d0-\u05ea]/;
const QUOTE = /["'״׳`”“’]/;
const VOWEL_LETTERS = '[וי]{0,2}';
const QUOTE_OPT = '["\'״׳]?';
const escapeRe = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The term as a list of letters: base forms, vowel letters (ו/י) dropped after the first letter, quotes dropped. */
function skeleton(term: string): { letters: string[]; loose: boolean } {
  const chars = [...term.trim()].filter((c) => !QUOTE.test(c)).map((c) => FINAL_TO_BASE[c] ?? c);
  if (!chars.some((c) => HEBREW.test(c))) return { letters: chars, loose: false };
  const consonants = chars.filter((c, i) => i === 0 || (c !== 'ו' && c !== 'י'));
  // Two consonants are too few to drop vowels from: "מים" as מ_מ would match "ממרח".
  return consonants.length >= 3 ? { letters: consonants, loose: true } : { letters: chars, loose: false };
}

/** One letter of the skeleton as a regex piece: either letter form, ה/א when it ends the term. */
function letterClass(c: string, last: boolean): string {
  if (last && (c === 'ה' || c === 'א')) return '[הא]';
  if (BASE_TO_FINAL[c]) return `[${c}${BASE_TO_FINAL[c]}]`;
  return escapeRe(c);
}

function join(letters: string[], hebrew: boolean): string {
  const sep = hebrew ? `${VOWEL_LETTERS}${QUOTE_OPT}` : QUOTE_OPT;
  return letters.map((c, i) => (c === '.' ? '.' : letterClass(c, i === letters.length - 1))).join(sep);
}

/**
 * Regex sources for each word of the query (at most five), matching the
 * spellings above, case-insensitively. Short or non-Hebrew words keep their
 * letters as typed (escaped), still with optional quote marks.
 */
export function searchPatterns(q: string, opts: { typos?: boolean } = {}): string[] {
  const words = q.split(/\s+/).map((w) => w.trim()).filter(Boolean).slice(0, 5);
  return words.map((w) => {
    const { letters, loose: hebrew } = skeleton(w);
    const exact = join(letters, hebrew);
    // A three-letter Hebrew word also matches its first two letters on the
    // retry: "מים" finds "במי מלח", "חלב" finds "חלבי".
    if (opts.typos && letters.length === 3 && HEBREW.test(letters[0])) {
      return `(?:${exact}|${join(letters.slice(0, 2), false)})`;
    }
    if (!opts.typos || letters.length < 4) return exact;
    // One missing or one wrong letter (not the first: people get that right).
    const variants = new Set([exact]);
    for (let i = 1; i < letters.length; i++) {
      variants.add(join([...letters.slice(0, i), ...letters.slice(i + 1)], hebrew));
      variants.add(join([...letters.slice(0, i), '.', ...letters.slice(i + 1)], hebrew));
    }
    return `(?:${[...variants].join('|')})`;
  });
}

/**
 * How well `name` matches the search terms (regex sources, as
 * `searchPatterns()` returns them). Per term: at the very start of the name
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

/** 1 for each term found anywhere in the name or maker (mid-word included). */
function wordsHit(h: Rankable, terms: string[]): number {
  let n = 0;
  for (const t of terms) {
    try {
      const re = new RegExp(t, 'iu');
      if (re.test(h.name) || (h.manufacturer && re.test(h.manufacturer))) n++;
    } catch {
      /* skip a bad pattern */
    }
  }
  return n;
}

/** 1 for each term the name misses but the manufacturer has. */
function makerScore(h: Rankable, terms: string[]): number {
  if (!h.manufacturer) return 0;
  let n = 0;
  for (const t of terms) {
    try {
      if (!new RegExp(t, 'iu').test(h.name) && new RegExp(t, 'iu').test(h.manufacturer)) n++;
    } catch {
      /* skip a bad pattern */
    }
  }
  return n;
}

export interface Rankable {
  name: string;
  /** Matched too: a term found only here scores 1. */
  manufacturer?: string;
  /** Stores in the city that sell it. */
  stores: number;
}

/**
 * Sorted copy of `hits`: sold in the city before not sold at all, then by
 * match score, then by how many stores sell it, then shorter names. Pass
 * `loose` (the typo patterns) when the search fell back to them.
 */
export function rankHits<T extends Rankable>(hits: T[], terms: string[], loose?: string[]): T[] {
  // With a typo retry, matching the words as typed outweighs any typo match:
  // "פילטונה" in the maker beats "פונטנה" (one letter off) at the start of a name.
  let scored = hits.map((h) => {
    const strict = matchScore(h.name, terms) + makerScore(h, terms);
    return {
      h,
      // How many words match as typed: on a typo retry this decides first.
      words: loose ? wordsHit(h, terms) : 0,
      s: loose ? strict * 10 + matchScore(h.name, loose) + makerScore(h, loose) : strict,
    };
  });
  // Once some hits match a word as typed, hits that only match through typos are noise.
  if (loose && scored.some((x) => x.words > 0)) scored = scored.filter((x) => x.words > 0);
  scored.sort(
    (a, b) =>
      Number(b.h.stores > 0) - Number(a.h.stores > 0) ||
      b.words - a.words ||
      b.s - a.s ||
      b.h.stores - a.h.stores ||
      a.h.name.length - b.h.name.length,
  );
  return scored.map((x) => x.h);
}
