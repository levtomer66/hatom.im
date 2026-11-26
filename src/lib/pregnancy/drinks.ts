// Caffeine (docs/superpowers/specs/2026-11-24-pregnancy-design.md § Caffeine): the
// built-in drinks, mg rules for catalog names, and the coffee-order mapping.
// Import-free (types only) for `node --test`.
//
// Sources (checked 2026-11-24):
// - Espresso: USDA FoodData Central, 212 mg/100 g → ~65 mg a 30 ml shot.
// - Instant coffee: USDA (63 mg / 2 g) and MoH ("כ־65").
// - Filter coffee: MoH and USDA, ~100 mg a 250 ml cup.
// - Black tea: MoH (~50) and USDA (48). Green tea: USDA (~30). Decaf: USDA (~3).
// - Coca-Cola / Coca-Cola Zero: Coca-Cola Israel FAQ, 10 mg/100 ml (diet 13): the fat
//   glass (280 ml) 28 mg, the striped glass (340 ml) 34 mg.
// - הפוך קטן 60 / הפוך גדול (a double shot) 120 / לונגו 65: the owner's figures.
// - Energy drinks: Red Bull / EFSA, 32 mg/100 ml.
// - Yotvata PRO coffee (350 ml, 130 kcal, 25 g protein on the bottle): 27 mg/100 ml
//   per Open Food Facts (two barcodes) and FoodsDictionary, checked 2026-11-26 → ~95 mg.
// - Dark chocolate ≥70%: USDA, ~80 mg/100 g.
// - Nespresso capsules: Nespresso publishes only ranges (40–130, mostly 50–100);
//   65 is an approximation, shown as "בערך".
// - Turkish/black coffee, iced coffee, שוקו: estimates (no authoritative figure).
// - MoH ("תזונה נבונה בתקופת ההיריון", 2015): avoid energy drinks, Turkish, black
//   and mud coffee — those drinks carry `warn`.

import type { CoffeeDrinkConfig } from '../../types/coffee-order.ts';

export interface Totals { kcal: number; p: number; c: number; f: number }

export interface Drink {
  id: string;
  name: string;
  emoji: string;
  /** One serving: כוס, פחית, שוט, קפסולה… */
  unit: string;
  /** One unit's ml (g for chocolate): the entry's unit weight. */
  g: number;
  /** Caffeine per unit, mg. */
  mg: number;
  /** Per unit. */
  nu: Totals;
  /** Other words people use for it. */
  aliases?: string[];
  /** The mg is an approximation. */
  approx?: boolean;
  /** A pregnancy note (MoH). */
  warn?: string;
}

const t = (kcal: number, p = 0, c = 0, f = 0): Totals => ({ kcal, p, c, f });
const AVOID = 'משרד הבריאות ממליץ להימנע בהריון';

export const DRINKS: readonly Drink[] = [
  { id: 'hafuch-small', name: 'הפוך קטן', emoji: '☕', unit: 'כוס', g: 240, mg: 60, nu: t(120, 6, 9, 6.5), aliases: ['הפוך', 'קפוצ׳ינו', 'קפוצינו', 'קפה הפוך'] },
  { id: 'hafuch-large', name: 'הפוך גדול (מנה כפולה)', emoji: '☕', unit: 'כוס', g: 350, mg: 120, nu: t(180, 9, 14, 9.5), aliases: ['הפוך גדול', 'הפוך כפול', 'קפוצ׳ינו גדול', 'קפוצינו גדול'] },
  { id: 'espresso', name: 'אספרסו', emoji: '⚡', unit: 'שוט', g: 30, mg: 65, nu: t(2), aliases: ['אספרסו קצר', 'שוט'] },
  { id: 'espresso-double', name: 'אספרסו כפול', emoji: '⚡', unit: 'כוס', g: 60, mg: 130, nu: t(4), aliases: ['דאבל'] },
  { id: 'lungo', name: 'לונגו', emoji: '🫗', unit: 'כוס', g: 110, mg: 65, nu: t(2), aliases: ['אספרסו ארוך'] },
  { id: 'capsule', name: 'קפסולה', emoji: '💊', unit: 'קפסולה', g: 40, mg: 65, nu: t(2), aliases: ['נספרסו', 'קפה מכונה'], approx: true },
  { id: 'instant', name: 'נס קפה', emoji: '🥄', unit: 'כוס', g: 250, mg: 65, nu: t(4), aliases: ['קפה נמס', 'נסקפה'] },
  { id: 'filter', name: 'קפה פילטר', emoji: '☕', unit: 'כוס', g: 250, mg: 100, nu: t(2), aliases: ['פילטר', 'קפה מסונן'] },
  { id: 'black', name: 'קפה שחור / טורקי', emoji: '🫖', unit: 'כוס', g: 150, mg: 80, nu: t(2), aliases: ['קפה שחור', 'קפה טורקי', 'שחור', 'טורקי', 'קפה בוץ'], approx: true, warn: AVOID },
  { id: 'iced', name: 'קפה קר', emoji: '🧊', unit: 'כוס', g: 300, mg: 100, nu: t(120, 4, 18, 3), aliases: ['אייס קפה', 'אייס', 'קפה קר'], approx: true },
  { id: 'decaf', name: 'קפה נטול קפאין', emoji: '🌙', unit: 'כוס', g: 250, mg: 3, nu: t(2), aliases: ['נטול', 'דקף'] },
  { id: 'tea-black', name: 'תה שחור', emoji: '🍵', unit: 'כוס', g: 250, mg: 50, nu: t(2), aliases: ['תה'] },
  { id: 'tea-green', name: 'תה ירוק', emoji: '🍵', unit: 'כוס', g: 250, mg: 30, nu: t(2) },
  { id: 'cola', name: 'קולה', emoji: '🥤', unit: 'פחית', g: 330, mg: 33, nu: t(139, 0, 35), aliases: ['קוקה קולה', 'פחית קולה'] },
  { id: 'zero-glass', name: 'זירו כוס שמנה', emoji: '🥤', unit: 'כוס', g: 280, mg: 28, nu: t(1), aliases: ['כוס זירו', 'זירו', 'קולה זירו', 'כוס שמנה'] },
  { id: 'zero-striped', name: 'זירו כוס פסים', emoji: '🥤', unit: 'כוס', g: 340, mg: 34, nu: t(1), aliases: ['כוס פסים'] },
  { id: 'zero-can', name: 'פחית זירו', emoji: '🥫', unit: 'פחית', g: 330, mg: 33, nu: t(1) },
  { id: 'diet-cola', name: 'פחית דיאט קולה', emoji: '🥫', unit: 'פחית', g: 330, mg: 43, nu: t(1), aliases: ['דיאט קולה', 'קולה דיאט'] },
  { id: 'energy', name: 'משקה אנרגיה', emoji: '🔋', unit: 'פחית', g: 250, mg: 80, nu: t(112, 0, 27), aliases: ['רד בול', 'אקס אל', 'XL'], warn: AVOID },
  { id: 'yotvata-pro', name: 'יטבתה PRO קפה', emoji: '💪', unit: 'בקבוק', g: 350, mg: 95, nu: t(130, 25, 7, 0), aliases: ['פרו קפה', 'יטבתה פרו', 'משקה חלבון קפה', 'PRO'] },
  { id: 'dark-choc', name: 'שוקולד מריר (50 ג׳)', emoji: '🍫', unit: 'חצי טבלה', g: 50, mg: 40, nu: t(300, 4, 23, 21), aliases: ['שוקולד מריר'] },
  { id: 'shoko', name: 'שוקו', emoji: '🥛', unit: 'כוס', g: 250, mg: 5, nu: t(180, 8, 27, 5), aliases: ['שוקו חם', 'שוקו קר'], approx: true },
];

const BY_ID = new Map(DRINKS.map((d) => [d.id, d]));
export const drinkById = (id: string): Drink | null => BY_ID.get(id) ?? null;

/** The built-in drink an entry or a search hit refers to; null for anything else. */
export const drinkOfRef = (ref: { kind: string; key: string | null }): Drink | null =>
  ref.kind === 'drink' && ref.key ? drinkById(ref.key) : null;

const norm = (s: string) => s.replace(/['`׳]/g, '׳').replace(/[^\p{L}\p{N}׳ ]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
/** `stem` as whole words in `text` ("שוקו" is not in "שוקולד"). */
const has = (text: string, stem: string) => ` ${text} `.includes(` ${stem} `);

/** The drink a free text names (MCP, search): the longest name or alias the text contains. */
export function matchDrink(text: string): Drink | null {
  const q = norm(text);
  if (!q) return null;
  // First the longest name the text holds ("הפוך גדול" in "2 הפוך גדול"); else the
  // shortest name holding the text ("הפוך" → הפוך קטן, not הפוך גדול).
  let inQ: { d: Drink; len: number } | null = null;
  let ofQ: { d: Drink; len: number } | null = null;
  for (const d of DRINKS) {
    for (const n of [d.name, ...(d.aliases ?? [])].map(norm)) {
      if (has(q, n) && (!inQ || n.length > inQ.len)) inQ = { d, len: n.length };
      else if (q.length >= 3 && n.includes(q) && (!ofQ || n.length < ofQ.len)) ofQ = { d, len: n.length };
    }
  }
  return (inQ ?? ofQ)?.d ?? null;
}

/** mg per 100 g/ml for catalog and MoH names. The longest stem wins; null = no caffeine known. */
const RULES: [string, number][] = [
  ['נטול קפאין', 1], ['דקף', 1],
  ['קולה זירו', 10], ['קוקה קולה', 10], ['קולה', 10], ['פפסי מקס', 10], ['פפסי', 10],
  ['דיאט קולה', 13], ['קולה דיאט', 13], ['קוקה קולה דיאט', 13],
  ['משקה אנרגיה', 32], ['רד בול', 32], ['אקס אל', 32],
  ['תה קר', 10], ['אייס טי', 10], ['נסטי', 10],
  ['קולד ברו', 43], ['פרו קפה', 27], ['קפה עם חלבון', 27], ['תרכיז קפה', 130],
  ['קפה קר', 25], ['אייס קפה', 25], ['קפה הפוך', 30], ['אספרסו', 212],
  ['תה ירוק', 12], ['תה שחור', 20],
  ['שוקולד מריר', 80], ['שוקו', 2],
];

export function cafPer100(name: string): number | null {
  const n = norm(name);
  let best: [string, number] | null = null;
  for (const r of RULES) if (has(n, r[0]) && (!best || r[0].length > best[0].length)) best = r;
  return best ? best[1] : null;
}

/** About 150 ml of 3% milk in a cappuccino or an iced coffee. */
const MILK = t(100, 5, 7.5, 5.5);

type OrderLike = Pick<CoffeeDrinkConfig, 'drink' | 'milk' | 'sugar' | 'source' | 'capsule' | 'vanillaPumps' | 'caramelPumps'>;

/** A coffee order as a drink entry: Tomer's machine = one capsule; a café = its own drink. */
export function orderDrink(o: OrderLike): { drink: Drink; mg: number; nu: Totals } {
  const machine = o.source === 'tomer-coffee';
  const id = machine ? 'capsule'
    : o.drink === 'espresso' ? 'espresso'
      : o.drink === 'lungo' ? 'lungo'
        : o.drink === 'iced-coffee' ? 'iced' : 'hafuch-small';
  const drink = drinkById(id) as Drink;
  const milky = o.drink === 'cappuccino' || o.drink === 'iced-coffee';
  // A café's milky drink already counts its milk; take it off when ordered without.
  const base = machine || !milky ? drink.nu : o.milk === 'none' ? t(2) : drink.nu;
  const milk = machine && milky && o.milk !== 'none' ? MILK : t(0);
  const sugar = o.sugar === 'none' ? 0 : Number(o.sugar);
  const pumps = (o.vanillaPumps || 0) + (o.caramelPumps || 0);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const nu = {
    kcal: Math.round(base.kcal + milk.kcal + 16 * sugar + 20 * pumps),
    p: r1(base.p + milk.p),
    c: r1(base.c + milk.c + 4 * sugar + 5 * pumps),
    f: r1(base.f + milk.f),
  };
  return { drink, mg: drink.mg, nu };
}

export const CAF_WARN = 150;
export const DEFAULT_CAF_LIMIT = 200;

/** green → amber from 150 mg (MoH links more than 150 to risks) → red over the limit. */
export const cafLevel = (mg: number, limit: number): 'ok' | 'warn' | 'over' =>
  mg > limit ? 'over' : mg >= Math.min(CAF_WARN, limit) ? 'warn' : 'ok';

/**
 * An entry's caffeine, set by the server when it's logged (spec § Caffeine): a
 * drink from the table × qty; a product or MoH food by its name's rule × grams;
 * a home-made meal from its items (`mealPerPortion`, mg per portion) × qty.
 */
export function entryCaf(e: { ref: { kind: string; key: string | null }; name: string; unit: { g: number }; qty: number }, mealPerPortion?: number | null): number | undefined {
  if (e.ref.kind === 'drink') {
    const d = e.ref.key ? drinkById(e.ref.key) : null;
    return d ? Math.round(d.mg * e.qty) : undefined;
  }
  if (e.ref.kind === 'meal') return mealPerPortion ? Math.round(mealPerPortion * e.qty) : undefined;
  if (e.ref.kind === 'product' || e.ref.kind === 'food') {
    const per = cafPer100(e.name);
    return per === null ? undefined : Math.round((per * e.unit.g * e.qty) / 100);
  }
  return undefined;
}

/** A home-made meal's ingredient: its caffeine for `grams`. */
export function itemCaf(i: { ref: { kind: string; key: string | null }; name: string; grams: number }): number | undefined {
  if (i.ref.kind === 'drink') {
    const d = i.ref.key ? drinkById(i.ref.key) : null;
    return d ? Math.round((d.mg * i.grams) / d.g) : undefined;
  }
  const per = cafPer100(i.name);
  return per === null ? undefined : Math.round((per * i.grams) / 100);
}

/** A home-made meal's items with their caffeine (set when the meal is saved). */
export const withCaf = <T extends { ref: { kind: string; key: string | null }; name: string; grams: number; caf?: number }>(items: T[]): T[] =>
  items.map((i) => {
    const { caf: _c, ...rest } = i;
    void _c;
    const caf = itemCaf(i);
    return (caf ? { ...rest, caf } : rest) as T;
  });

/** Built-in drinks a search box text names: by name or alias, either way round. */
export function drinksMatching(q: string): Drink[] {
  const n = norm(q);
  if (n.length < 2) return [];
  // Whole words either way ("שוקולד" is not שוקו), or a word still being typed ("הפו").
  return DRINKS.filter((d) => [d.name, ...(d.aliases ?? [])].map(norm).some((x) =>
    has(x, n) || has(n, x) || (!n.includes(' ') && x.split(' ').some((w) => w.startsWith(n)))));
}
