// Fuzzy exercise search — PROTOTYPE. Import-free for node --test.
//
// Every query word must match some word of the exercise's search texts
// (names in every language, muscle labels, machine names and aliases).
// A word matches by prefix, by substring (≥3 chars), or within a small edit
// distance (1 typo for 4–6 chars, 2 for 7+). Hebrew niqqud/geresh and
// final letters are normalised so "פולי" ≈ "פוליי", "סמית׳" ≈ "סמית".

export interface SearchDoc {
  id: string;
  texts: string[];
}

// Query word → extra words it also means. Keys and values are normalised.
const SYNONYMS: Record<string, string[]> = {
  pulley: ['cable'],
  cable: ['pulley'],
  pec: ['chest'],
  pecs: ['chest'],
  delts: ['shoulders'],
  delt: ['shoulders'],
  lats: ['back', 'lat'],
  bi: ['biceps'],
  bis: ['biceps'],
  tri: ['triceps'],
  tris: ['triceps'],
  hammies: ['hamstrings'],
  quad: ['quads'],
  glute: ['glutes'],
  booty: ['glutes'],
  abs: ['abdominal', 'core'],
  core: ['abs'],
  db: ['dumbbell'],
  bb: ['barbell'],
  rdl: ['romanian'],
  ohp: ['overhead'],
  'פולי': ['cable', 'pulldown'],
  'חזה': ['chest'],
  'גב': ['back'],
  'כתפיים': ['shoulders'],
  'כתף': ['shoulders'],
  'יד': ['biceps', 'triceps'],
  'בייספס': ['biceps'],
  'טרייספס': ['triceps'],
  'רגליים': ['legs'],
  'רגל': ['legs'],
  'ישבן': ['glutes'],
  'טוסיק': ['glutes'],
  'בטן': ['abs'],
  'סקוואט': ['squat'],
  'דדליפט': ['deadlift'],
  'מתח': ['pull-up', 'pullup'],
  'שכיבות': ['push-up'],
};

// Built lazily: keys must go through normalize() too ("כתפיים" → "כתפיימ").
let normalizedSynonyms: Map<string, string[]> | null = null;
function synonymsFor(q: string): string[] {
  if (!normalizedSynonyms) {
    normalizedSynonyms = new Map(
      Object.entries(SYNONYMS).map(([k, v]) => [normalize(k), v.flatMap(words)]),
    );
  }
  return normalizedSynonyms.get(q) ?? [];
}

const FINAL_LETTERS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // niqqud / cantillation
    .replace(/[׳״'"`’]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c])
    .replace(/[-_/().,+&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function words(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

// Levenshtein with an early exit once every cell in a row exceeds max.
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function allowedTypos(len: number): number {
  if (len >= 7) return 2;
  if (len >= 4) return 1;
  return 0;
}

// Score of one query word against one doc word (0 = no match).
function wordScore(q: string, w: string): number {
  if (w === q) return 10;
  if (w.startsWith(q)) return 8;
  if (q.length >= 3 && w.includes(q)) return 5;
  const max = allowedTypos(q.length);
  if (max > 0) {
    // Compare against the doc word, and against its prefix of the query's
    // length so a typo in a half-typed word still matches ("pulldwn").
    const d = Math.min(
      editDistance(q, w, max),
      w.length > q.length ? editDistance(q, w.slice(0, q.length), max) : max + 1,
    );
    if (d <= max) return 4 - d;
  }
  return 0;
}

function bestScore(alternatives: string[], docWords: string[]): number {
  let best = 0;
  for (const q of alternatives) {
    for (const w of docWords) {
      const s = wordScore(q, w);
      if (s > best) best = s;
      if (best === 10) return best;
    }
  }
  return best;
}

// Returns matching doc ids, best first. Docs that miss any query word drop out.
export function fuzzySearch(query: string, docs: SearchDoc[]): string[] {
  const qWords = words(query);
  if (qWords.length === 0) return docs.map((d) => d.id);
  const qAlts = qWords.map((q) => [q, ...(synonymsFor(q))]);

  const scored: { id: string; score: number; order: number }[] = [];
  docs.forEach((doc, order) => {
    // First text is the display name — matches there count extra.
    const nameWords = words(doc.texts[0] ?? '');
    const allWords = doc.texts.flatMap(words);
    let total = 0;
    for (const alts of qAlts) {
      const s = bestScore(alts, allWords);
      if (s === 0) return;
      total += s + (bestScore(alts, nameWords) > 0 ? 3 : 0);
    }
    scored.push({ id: doc.id, score: total, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((s) => s.id);
}
