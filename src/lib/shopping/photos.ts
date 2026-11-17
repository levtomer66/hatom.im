// Photos for items no source shows. Photo links come only from Wolt, by
// barcode — and loose produce never has one: each chain publishes "עגבניה"
// under its own internal code. So an item without a photo borrows one from a
// photographed item whose name means the same product (photoByName), after
// sizes, units and packaging words are stripped and Hebrew plurals reduced to
// a stem. A wrong photo is worse than none, so a match needs the same
// department, the same head word, and every word of the item's name in the
// candidate's (which may add one). Import-free.

/** Words that don't change what the product looks like. */
const WEAK = new Set([
  'ארוז', 'ארוזה', 'ארוזים', 'ארוזות', 'במשקל', 'תפזורת', 'בתפזורת', 'מובחר', 'מובחרת', 'מובחרים', 'מובחרות',
  'טרי', 'טריה', 'טריים', 'טריות', 'ישראל', 'ישראלי', 'ישראלית', 'אורגני', 'אורגנית', 'אורגניים', 'אורגניות',
  'פרימיום', 'חדש', 'חדשה', 'מבצע', 'ק', 'קג', 'גר', 'גרם', 'ג', 'ליטר', 'ל', 'מל', 'יח', 'יחידות', 'יחידה',
  'בקרטון', 'קרטון', 'מארז', 'שקית', 'בשקית', 'סלסלה', 'בסלסלה', 'מגש', 'במגש', 'סוג', 'א', 'ב', 'מס', 'מ', 'גרמ', 'ליט',
]);

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** Hebrew stem: final letters as regular ones, יי → י, plural/feminine endings stripped. */
export function stem(word: string): string {
  let w = word.replace(/[ךםןףץ]/g, (c) => FINALS[c]).replace(/יי/g, 'י');
  for (let i = 0; i < 3 && w.length > 3; i++) {
    const next = w.replace(/(יות|ות|ימ|יה|ה|ת|י)$/, '');
    if (next === w || next.length < 3) break;
    w = next;
  }
  return w;
}

/** The words that say what the product is, stemmed, in order. */
export function coreWords(name: string): string[] {
  const words = name
    .toLowerCase()
    // Numbers are often glued to words ("קוטג%5מהדרין250גר"): split there, don't drop the word.
    .replace(/[\d%]+/g, ' ')
    .replace(/[|,()[\]{}+*/\\.:;!?״"׳'`–-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/\d/.test(w) && !WEAK.has(w) && !WEAK.has(w.replace(/^[בהו]/, '')));
  const out: string[] = [];
  for (const w of words.map(stem)) if (!out.includes(w)) out.push(w);
  return out;
}

export interface PhotoCandidate {
  key: string;
  name: string;
  d?: string;
  img?: string;
}

/**
 * Photo links for the items without one, keyed by item key. A candidate
 * matches when it is in the same department, starts with the same word, and
 * has every word of the item's name plus at most one more (so "עגבניה" takes
 * "עגבנייה אשכולות | ישראל", but "מלפפון במלח" never takes a fresh cucumber).
 * The closest match wins; ties go to the smallest link (stable).
 */
export function photoByName(items: PhotoCandidate[]): Map<string, string> {
  const byHead = new Map<string, { words: Set<string>; d?: string; img: string }[]>();
  for (const it of items) {
    if (!it.img) continue;
    const words = coreWords(it.name);
    if (!words.length) continue;
    const k = `${it.d ?? ''}|${words[0]}`;
    let list = byHead.get(k);
    if (!list) byHead.set(k, (list = []));
    list.push({ words: new Set(words), d: it.d, img: it.img });
  }
  const out = new Map<string, string>();
  for (const it of items) {
    if (it.img || !it.d) continue;
    const words = coreWords(it.name);
    if (!words.length) continue;
    const mine = new Set(words);
    let best: { diff: number; img: string } | null = null;
    for (const c of byHead.get(`${it.d}|${words[0]}`) ?? []) {
      // Every word of the item must be in the candidate's name, which may add
      // one: "מלפפון במלח" must not borrow a plain "מלפפון".
      let missing = false;
      for (const w of mine) if (!c.words.has(w)) missing = true;
      const diff = c.words.size - mine.size;
      if (missing || diff > 1) continue;
      if (!best || diff < best.diff || (diff === best.diff && c.img < best.img)) best = { diff, img: c.img };
    }
    if (best) out.set(it.key, best.img);
  }
  return out;
}
