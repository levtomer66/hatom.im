// Recipe rules: what a PATCH may change and its limits, a new line from its
// text, an empty recipe, who may read one, and the MCP recipes_save input.
// Import-free (node --test).

import { parseLine } from './line.ts';
import { toGrams, UNITS } from './units.ts';
import { LIMITS, type Ingredient, type Link, type Recipe } from './types.ts';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type RecipePatch = Partial<Pick<Recipe, 'name' | 'servings' | 'ingredients' | 'steps' | 'tags' | 'prepMin' | 'cookMin' | 'notes'>> & { shared?: boolean };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strOrNull = (v: unknown, max: number) => v === null || v === undefined || (typeof v === 'string' && v.length <= max);
const KEY = /^[\w:.-]{1,60}$/;

function parseLink(v: unknown): Link | null | 'bad' {
  if (v === null || v === undefined) return null;
  if (!isObj(v) || !isObj(v.ref) || !isObj(v.per100)) return 'bad';
  const { kind, key } = v.ref;
  if ((kind !== 'product' && kind !== 'food') || typeof key !== 'string' || !KEY.test(key)) return 'bad';
  if (typeof v.name !== 'string' || v.name.length > 200 || !strOrNull(v.img, 500)) return 'bad';
  const per = v.per100;
  const nums = [per.kcal, per.p, per.c, per.f];
  if (!nums.every((n) => isNum(n) && n >= 0 && n <= 1000)) return 'bad';
  return {
    ref: { kind, key }, name: v.name, img: (v.img as string | null | undefined) ?? null,
    per100: { kcal: per.kcal as number, p: per.p as number, c: per.c as number, f: per.f as number },
  };
}

function parseIngredient(v: unknown): Ingredient | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== 'string' || !v.id || v.id.length > 40) return null;
  if (typeof v.text !== 'string' || v.text.length > LIMITS.ingredientText) return null;
  if (!(v.qty === null || (isNum(v.qty) && v.qty > 0 && v.qty <= 100000))) return null;
  if (!(v.unit === null || (typeof v.unit === 'string' && v.unit in UNITS))) return null;
  if (typeof v.name !== 'string' || v.name.length > LIMITS.ingredientText) return null;
  if (!(v.grams === null || (isNum(v.grams) && v.grams > 0 && v.grams <= 20000))) return null;
  const link = parseLink(v.link);
  if (link === 'bad') return null;
  if (!(v.key === null || v.key === undefined || (typeof v.key === 'string' && KEY.test(v.key)))) return null;
  if (!strOrNull(v.orig, LIMITS.ingredientText) || !strOrNull(v.alt, LIMITS.ingredientText)) return null;
  return {
    id: v.id, text: v.text, qty: v.qty as number | null, unit: v.unit as string | null, name: v.name,
    grams: v.grams === null ? null : Math.round(v.grams as number), link, key: (v.key as string | null | undefined) ?? null,
    orig: (v.orig as string | null | undefined) ?? null, alt: (v.alt as string | null | undefined) ?? null, auto: v.auto === true,
  };
}

const minutes = (v: unknown) => v === null || (isNum(v) && Number.isInteger(v) && v >= 0 && v <= LIMITS.minutes);

function cleanTags(v: unknown[]): string[] | null {
  const out: string[] = [];
  for (const t of v) {
    if (typeof t !== 'string') return null;
    const s = t.replace(/\s+/g, ' ').trim();
    if (s.length > LIMITS.tagText) return null;
    if (s && !out.includes(s)) out.push(s);
  }
  return out.length > LIMITS.tags ? null : out;
}

/** Only the keys sent, each checked; unknown keys are dropped. */
export function parseRecipePatch(v: unknown): Result<RecipePatch> {
  if (!isObj(v)) return fail('בקשה לא תקינה');
  const out: RecipePatch = {};
  if ('name' in v) {
    if (typeof v.name !== 'string' || !v.name.trim()) return fail('חסר שם');
    if (v.name.trim().length > LIMITS.name) return fail('שם ארוך מדי');
    out.name = v.name.trim();
  }
  if ('servings' in v) {
    if (!isNum(v.servings) || !Number.isInteger(v.servings) || v.servings < 1 || v.servings > LIMITS.servingsMax) return fail('מספר מנות לא תקין');
    out.servings = v.servings;
  }
  if ('ingredients' in v) {
    if (!Array.isArray(v.ingredients)) return fail('מצרכים לא תקינים');
    if (v.ingredients.length > LIMITS.ingredients) return fail('יותר מדי מצרכים');
    const list: Ingredient[] = [];
    for (const raw of v.ingredients) {
      const ing = parseIngredient(raw);
      if (!ing) return fail('מצרך לא תקין');
      list.push(ing);
    }
    out.ingredients = list;
  }
  if ('steps' in v) {
    if (!Array.isArray(v.steps) || v.steps.length > LIMITS.steps) return fail('יותר מדי שלבים');
    if (!v.steps.every((s) => typeof s === 'string' && s.length <= LIMITS.stepText)) return fail('שלב ארוך מדי');
    out.steps = v.steps as string[];
  }
  if ('tags' in v) {
    const tags = Array.isArray(v.tags) ? cleanTags(v.tags) : null;
    if (!tags) return fail('תגיות לא תקינות');
    out.tags = tags;
  }
  if ('prepMin' in v) { if (!minutes(v.prepMin)) return fail('זמן לא תקין'); out.prepMin = v.prepMin as number | null; }
  if ('cookMin' in v) { if (!minutes(v.cookMin)) return fail('זמן לא תקין'); out.cookMin = v.cookMin as number | null; }
  if ('notes' in v) {
    if (typeof v.notes !== 'string' || v.notes.length > LIMITS.notes) return fail('הערות ארוכות מדי');
    out.notes = v.notes;
  }
  if ('shared' in v) {
    if (typeof v.shared !== 'boolean') return fail('בקשה לא תקינה');
    out.shared = v.shared;
  }
  return { ok: true, value: out };
}

/** A line from its text: amount, unit, name and an estimate of its grams. */
export function newIngredient(text: string, id: string): Ingredient {
  const t = text.slice(0, LIMITS.ingredientText);
  const { qty, unit, name } = parseLine(t);
  return { id, text: t, qty, unit, name, grams: toGrams(qty, unit, name), link: null, key: null, orig: null, alt: null, auto: false };
}

export function emptyRecipe(): Omit<Recipe, 'id' | 'owner' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'מתכון חדש', servings: 2, ingredients: [], steps: [], tags: [], prepMin: null, cookMin: null,
    photo: null, notes: '', source: null, shared: null, copiedFrom: null,
  };
}

/** The owner, or anyone while it's on the feed. */
export const canRead = (r: Pick<Recipe, 'owner' | 'shared'>, email: string): boolean => r.owner === email || !!r.shared;

const httpUrl = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length > 2000) return false;
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
};

/** MCP recipes_save input → a full recipe patch. Errors name the field (in English, for the model). */
export function parseSaveArgs(args: Record<string, unknown>): Result<{
  recipe: RecipePatch & { name: string; servings: number; ingredients: Ingredient[]; steps: string[] };
  sourceUrl: string | null;
  imageUrl: string | null;
}> {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  if (!name) return fail('name is required');
  if (!Array.isArray(args.ingredients)) return fail('ingredients must be an array');
  if (!Array.isArray(args.steps)) return fail('steps must be an array of strings');
  const ingredients: Ingredient[] = [];
  for (let n = 0; n < args.ingredients.length; n++) {
    const raw = args.ingredients[n];
    const text = isObj(raw) && typeof raw.text === 'string' ? raw.text.trim() : '';
    if (!text) return fail(`ingredients[${n}].text is required`);
    const r = raw as Record<string, unknown>;
    const ing = newIngredient(text, `i${n + 1}`);
    ing.orig = typeof r.orig === 'string' && r.orig.trim() ? r.orig.trim().slice(0, LIMITS.ingredientText) : null;
    ing.alt = typeof r.alt === 'string' && r.alt.trim() ? r.alt.trim().slice(0, LIMITS.ingredientText) : null;
    ingredients.push(ing);
  }
  if (args.source_url !== undefined && args.source_url !== null && !httpUrl(args.source_url)) return fail('source_url must be an http(s) URL');
  if (args.image_url !== undefined && args.image_url !== null && !httpUrl(args.image_url)) return fail('image_url must be an http(s) URL');
  const patch = parseRecipePatch({
    name, servings: args.servings, ingredients, steps: args.steps.map((s) => (typeof s === 'string' ? s.trim() : s)),
    tags: args.tags ?? [], prepMin: args.prep_min ?? null, cookMin: args.cook_min ?? null, notes: args.notes ?? '',
  });
  if (!patch.ok) {
    const map: Record<string, string> = {
      'מספר מנות לא תקין': 'servings must be a whole number 1–100', 'יותר מדי מצרכים': 'at most 60 ingredients',
      'יותר מדי שלבים': 'at most 40 steps', 'שלב ארוך מדי': 'each step must be a string of at most 1000 characters',
      'תגיות לא תקינות': 'tags: at most 10 strings of 30 characters', 'זמן לא תקין': 'prep_min/cook_min: whole minutes 0–1440',
      'שם ארוך מדי': 'name: at most 120 characters', 'הערות ארוכות מדי': 'notes: at most 2000 characters',
    };
    return fail(map[patch.error] ?? patch.error);
  }
  return {
    ok: true,
    value: {
      recipe: patch.value as RecipePatch & { name: string; servings: number; ingredients: Ingredient[]; steps: string[] },
      sourceUrl: (args.source_url as string | undefined) ?? null,
      imageUrl: (args.image_url as string | undefined) ?? null,
    },
  };
}
