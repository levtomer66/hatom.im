// Nutrition facts for items (docs/shopping-nutrition.md): the values the
// ingest stores on an item doc (`nu`), reading and checking an Open Food
// Facts row, the Israeli red-label rule, pack sizes and a list's totals.
// Import-free, for `node --test` and for both the ingest and the app.

/** Per 100 g (100 ml for drinks). Null = not published. Sodium in mg. */
export interface Nutrition {
  kcal: number | null;
  /** Protein, carbohydrates, of them sugars, fat, of it saturated, fibre: grams. */
  p: number | null;
  c: number | null;
  s: number | null;
  f: number | null;
  sf: number | null;
  fib: number | null;
  na: number | null;
  /** Where the values come from: Open Food Facts (by barcode), the Ministry of Health table, or typed by us. */
  by: 'off' | 'moh' | 'manual';
}

export const NUTRIENTS = ['kcal', 'p', 'c', 's', 'f', 'sf', 'fib', 'na'] as const;
export type Nutrient = (typeof NUTRIENTS)[number];

/** Label, unit and decimals per nutrient, in the order of an Israeli label. */
export const NUTRIENT_INFO: Record<Nutrient, { name: string; unit: string; digits: number }> = {
  kcal: { name: 'אנרגיה', unit: 'קק״ל', digits: 0 },
  p: { name: 'חלבונים', unit: 'גרם', digits: 1 },
  c: { name: 'פחמימות', unit: 'גרם', digits: 1 },
  s: { name: 'מתוכן סוכרים', unit: 'גרם', digits: 1 },
  f: { name: 'שומנים', unit: 'גרם', digits: 1 },
  sf: { name: 'מתוכם שומן רווי', unit: 'גרם', digits: 1 },
  fib: { name: 'סיבים תזונתיים', unit: 'גרם', digits: 1 },
  na: { name: 'נתרן', unit: 'מ״ג', digits: 0 },
};

/** The item doc's `nu` (written by the ingest), read before that type is on ItemDoc. */
export const nutritionOf = (doc: object): Nutrition | null => {
  const nu = (doc as { nu?: unknown }).nu;
  if (!nu || typeof nu !== 'object') return null;
  const n = nu as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const by = n.by === 'off' || n.by === 'moh' || n.by === 'manual' ? n.by : 'off';
  const out = { kcal: num(n.kcal), p: num(n.p), c: num(n.c), s: num(n.s), f: num(n.f), sf: num(n.sf), fib: num(n.fib), na: num(n.na), by } satisfies Nutrition;
  return out.kcal === null && out.p === null && out.s === null && out.na === null ? null : out;
};

// ── Open Food Facts ──

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const round = (v: number | null, digits: number) => (v === null ? null : Math.round(v * 10 ** digits) / 10 ** digits);

/**
 * An Open Food Facts row (the CSV export's or the API's `nutriments`
 * columns) as our values per 100 g, or null when it has none of them.
 * Energy falls back to kJ ÷ 4.184; sodium (grams) to salt ÷ 2.5.
 */
export function parseOff(row: Record<string, unknown>): Nutrition | null {
  const kj = num(row['energy-kj_100g']) ?? num(row['energy_100g']);
  const kcal = num(row['energy-kcal_100g']) ?? (kj !== null ? kj / 4.184 : null);
  const sodiumG = num(row['sodium_100g']) ?? (num(row['salt_100g']) !== null ? num(row['salt_100g'])! / 2.5 : null);
  const nu: Nutrition = {
    kcal: round(kcal, 0),
    p: round(num(row['proteins_100g']), 1),
    c: round(num(row['carbohydrates_100g']), 1),
    s: round(num(row['sugars_100g']), 1),
    f: round(num(row['fat_100g']), 1),
    sf: round(num(row['saturated-fat_100g']), 1),
    fib: round(num(row['fiber_100g']), 1),
    na: sodiumG === null ? null : Math.round(sodiumG * 1000),
    by: 'off',
  };
  return NUTRIENTS.every((k) => nu[k] === null) ? null : nu;
}

/**
 * Whether the values can be real (Open Food Facts rows are typed by
 * volunteers; spike 2026-11-17: Dubonim with 160 g sodium, Tortit at 233
 * kcal). Physical limits per 100 g, parts within their totals, and calories
 * within 25% (or 20 kcal) of 4·protein + 4·carbs + 9·fat when all are known.
 */
export function plausible(nu: Nutrition): string | null {
  const grams: Nutrient[] = ['p', 'c', 's', 'f', 'sf', 'fib'];
  if (nu.kcal !== null && (nu.kcal < 0 || nu.kcal > 900)) return 'kcal out of range';
  for (const k of grams) if (nu[k] !== null && (nu[k]! < 0 || nu[k]! > 100)) return `${k} out of range`;
  if (nu.na !== null && (nu.na < 0 || nu.na > 40_000)) return 'sodium out of range';
  if ((nu.p ?? 0) + (nu.c ?? 0) + (nu.f ?? 0) > 105) return 'macros above 100 g';
  if (nu.s !== null && nu.c !== null && nu.s > nu.c + 1) return 'sugars above carbohydrates';
  if (nu.sf !== null && nu.f !== null && nu.sf > nu.f + 0.5) return 'saturated above fat';
  if (nu.kcal !== null && nu.p !== null && nu.c !== null && nu.f !== null) {
    const atwater = 4 * nu.p + 4 * nu.c + 9 * nu.f;
    if (Math.abs(nu.kcal - atwater) > Math.max(20, 0.25 * Math.max(nu.kcal, atwater))) return 'calories do not match the macros';
  }
  return null;
}

const FINAL: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const words = (s: string) =>
  s.toLowerCase().replace(/[״"'׳`]/g, '').replace(/[ךםןףץ]/g, (c) => FINAL[c]).replace(/יי/g, 'י').replace(/וו/g, 'ו')
    .split(/[^a-zא-ת0-9]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w));

/**
 * Whether an Open Food Facts product name can be ours: when it's in Hebrew
 * it must share a word (3+ letters) with our name or maker, so a barcode
 * that points at another product is caught. Names in other scripts
 * ("Klik", "dubonim") pass — only the numbers can vouch for them.
 */
export function namesAgree(ours: string, maker: string, theirs: string | null | undefined): boolean {
  if (!theirs || !/[א-ת]/.test(theirs)) return true;
  const own = new Set(words(`${ours} ${maker}`));
  return words(theirs).some((w) => own.has(w) || [...own].some((o) => o.length >= 4 && w.length >= 4 && (o.startsWith(w) || w.startsWith(o))));
}

// ── the red label (תקנות הגנה על בריאות הציבור (מזון) (סימון תזונתי), התשע״ח–2017, תקנה 5) ──

/** Above these per 100 g (solid) / 100 ml (liquid), the package carries a red label. */
export const RED_LABEL = {
  solid: { na: 400, s: 10, sf: 4 },
  liquid: { na: 300, s: 5, sf: 3 },
} as const;

export const RED_LABEL_TEXT: Record<'na' | 's' | 'sf', string> = { na: 'נתרן', s: 'סוכר', sf: 'שומן רווי' };

/** Departments the label never applies to: fresh produce, coffee and tea, alcohol (תקנה 3, 6). */
const NO_RED_LABEL = new Set(['produce', 'coffee', 'alcohol']);

/** Only drinks count as liquid: the regulation counts semi-solid and viscous food as solid. */
export const isLiquid = (uq: string | null | undefined, d: string | null | undefined) =>
  d === 'drinks' && /מ"?ל|מיליליטר|ליטר/.test(uq ?? '');

/** The red labels the values call for ("נתרן", "סוכר", "שומן רווי"), strictly above the thresholds. */
export function redLabels(nu: Nutrition, liquid: boolean, d: string | null | undefined): ('na' | 's' | 'sf')[] {
  if (d && NO_RED_LABEL.has(d)) return [];
  const t = liquid ? RED_LABEL.liquid : RED_LABEL.solid;
  return (['na', 's', 'sf'] as const).filter((k) => nu[k] !== null && nu[k]! > t[k]);
}

// ── amounts and totals ──

/** Grams (ml for drinks) in one pack, from the price file's quantity and unit; null when not by weight or volume. */
export function packGrams(q: number | null | undefined, uq: string | null | undefined): number | null {
  if (!q || q <= 0) return null;
  const u = uq ?? '';
  if (/^(גרם|גר|ג)$/.test(u) || u === 'גרמים') return q;
  if (/קילו|ק"ג|קג/.test(u)) return q * 1000;
  if (/מיליליטר|מ"ל|מל/.test(u)) return q;
  if (/ליטר/.test(u)) return q * 1000;
  return null;
}

/** Grams of an item a list line holds: kg for weighed items, packs × pack size otherwise; null when unknown. */
export const lineGrams = (qty: number, w: boolean, pack: number | null) => (w ? qty * 1000 : pack ? qty * pack : null);

/** A value for `grams` of food, from its per-100 value. */
export const forGrams = (per100: number | null, grams: number) => (per100 === null ? null : (per100 * grams) / 100);

export const HERO_NUTRIENTS = ['kcal', 'p', 's', 'na'] as const;
export type HeroNutrient = (typeof HERO_NUTRIENTS)[number];

export interface ListNutrition {
  totals: Record<HeroNutrient, number>;
  /** Lines with values and a known amount, of all lines. */
  covered: number;
  of: number;
  /** Per nutrient, the lines that add the most, biggest first (at most 3). */
  top: Record<HeroNutrient, { key: string; amount: number }[]>;
  /** Lines whose values call for a red label. */
  red: string[];
  /** Lines with no values or no known amount. */
  missing: string[];
}

/**
 * Totals of a list: each line's grams (packs × pack size, or kg) times its
 * per-100 values. Lines without values or an amount are counted as missing,
 * never guessed.
 */
export function listNutrition(
  lines: { key: string; qty: number }[],
  meta: Record<string, { nu: Nutrition | null; pack: number | null; w: boolean; liquid: boolean; d: string | null } | undefined>,
): ListNutrition {
  const totals = { kcal: 0, p: 0, s: 0, na: 0 };
  const parts: Record<HeroNutrient, { key: string; amount: number }[]> = { kcal: [], p: [], s: [], na: [] };
  const red: string[] = [];
  const missing: string[] = [];
  let covered = 0;
  for (const l of lines) {
    const m = meta[l.key];
    const grams = m ? lineGrams(l.qty, m.w, m.pack) : null;
    if (!m?.nu || grams === null) {
      missing.push(l.key);
      continue;
    }
    covered++;
    if (redLabels(m.nu, m.liquid, m.d).length) red.push(l.key);
    for (const k of HERO_NUTRIENTS) {
      const v = forGrams(m.nu[k], grams);
      if (v === null) continue;
      totals[k] += v;
      parts[k].push({ key: l.key, amount: v });
    }
  }
  const top = Object.fromEntries(HERO_NUTRIENTS.map((k) => [k, parts[k].sort((a, b) => b.amount - a.amount).slice(0, 3)])) as ListNutrition['top'];
  return { totals, covered, of: lines.length, top, red, missing };
}
