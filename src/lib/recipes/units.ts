// Recipe units: the Hebrew words a line's amount is written in, what each
// measures (ml, g or pieces) and how big it is, plus the estimate of an
// ingredient's grams from its amount (for nutrition). Import-free (node --test).

export type UnitKind = 'ml' | 'g' | 'piece';

export interface UnitDef {
  kind: UnitKind;
  /** ml for volume, g for weight, 0 for pieces (their weight comes from the ingredient). */
  size: number;
  plural: string;
  aliases: string[];
}

export const UNITS: Record<string, UnitDef> = {
  'כוס': { kind: 'ml', size: 240, plural: 'כוסות', aliases: ['כוסות'] },
  'כף': { kind: 'ml', size: 15, plural: 'כפות', aliases: ['כפות'] },
  'כפית': { kind: 'ml', size: 5, plural: 'כפיות', aliases: ['כפיות'] },
  'מ״ל': { kind: 'ml', size: 1, plural: 'מ״ל', aliases: ['מ"ל', "מ'ל", 'מל', 'מיליליטר'] },
  'ליטר': { kind: 'ml', size: 1000, plural: 'ליטר', aliases: ['ליטרים', "ל'"] },
  'גרם': { kind: 'g', size: 1, plural: 'גרם', aliases: ['גר', "גר'", 'גר׳', 'ג׳', "ג'", 'גרמים'] },
  'ק״ג': { kind: 'g', size: 1000, plural: 'ק״ג', aliases: ['ק"ג', "ק'ג", 'קג', 'קילו', 'קילוגרם'] },
  'יחידה': { kind: 'piece', size: 0, plural: 'יחידות', aliases: ['יחידות'] },
  'שן': { kind: 'piece', size: 0, plural: 'שיני', aliases: ['שיני', 'שן'] },
  'חבילה': { kind: 'piece', size: 0, plural: 'חבילות', aliases: ['חבילות'] },
  'פחית': { kind: 'piece', size: 0, plural: 'פחיות', aliases: ['פחיות'] },
  'קורט': { kind: 'piece', size: 0, plural: 'קורט', aliases: [] },
};

const BY_WORD = new Map<string, string>();
for (const [key, def] of Object.entries(UNITS)) {
  BY_WORD.set(key, key);
  for (const a of def.aliases) BY_WORD.set(a, key);
}

/** The unit key a word names ("כפות" → "כף"), or null. */
export function unitKey(word: string): string | null {
  return BY_WORD.get(word.trim()) ?? null;
}

/** g per ml for common ingredients (matched when the name contains the word); others count as water. */
const DENSITY: [string, number][] = [
  ['קמח', 0.53], ['אבקת סוכר', 0.5], ['סוכר', 0.85], ['אורז', 0.8], ['שמן', 0.92],
  ['חמאה', 0.96], ['דבש', 1.4], ['סילאן', 1.4], ['קקאו', 0.4], ['שיבולת שועל', 0.4],
];

/** Grams of one piece, by the ingredient's name (singular, plural or a stem). */
const PIECE_G: [string, number][] = [
  ['ביצ', 55], ['בצל', 150], ['עגבני', 120], ['תפוח אדמה', 170], ['תפוחי אדמה', 170],
  ['גזר', 70], ['מלפפון', 100], ['לימון', 100], ['פלפל', 150], ['בטטה', 250], ['קישוא', 200], ['חציל', 300],
];

/** Weight of one clove / one unit for unit-specific pieces. */
const UNIT_PIECE_G: Record<string, number> = { 'שן': 5 };

const r0 = (n: number) => Math.round(n);

/** An ingredient's grams from its amount; null when there is no amount or no way to know. */
export function toGrams(qty: number | null, unit: string | null, name: string): number | null {
  if (qty === null || !Number.isFinite(qty) || qty <= 0) return null;
  const def = unit ? UNITS[unit] : undefined;
  if (def?.kind === 'g') return r0(qty * def.size);
  if (def?.kind === 'ml') {
    const d = DENSITY.find(([w]) => name.includes(w))?.[1] ?? 1;
    return r0(qty * def.size * d);
  }
  if (unit && UNIT_PIECE_G[unit] !== undefined) return r0(qty * UNIT_PIECE_G[unit]);
  if (unit && unit !== 'יחידה') return null; // a pack, a can: unknown size
  const g = PIECE_G.find(([w]) => name.startsWith(w))?.[1];
  return g === undefined ? null : r0(qty * g);
}

/** °F → °C, rounded to 5 (oven temperatures). */
export const fToC = (f: number): number => Math.round(((f - 32) * 5) / 9 / 5) * 5;
