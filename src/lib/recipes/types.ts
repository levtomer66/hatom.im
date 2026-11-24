// Recipe shapes shared by the page, the routes, the model and the MCP tools.
// Import-free (node --test). Spec: docs/superpowers/specs/2026-11-24-recipes-design.md.

/** kcal and grams of protein, carbohydrates and fat (calories' Totals). */
export interface Totals { kcal: number; p: number; c: number; f: number }

/** Where a line's nutrition comes from: a catalog product or an MoH food, per 100 g frozen when linked. */
export interface Link {
  ref: { kind: 'product' | 'food'; key: string };
  name: string;
  img: string | null;
  per100: Totals;
}

export interface Ingredient {
  /** Stable per line (React keys, autosave, 🛒 picks). */
  id: string;
  /** The line as shown: "2 כוסות קמח לבן". */
  text: string;
  /** Parsed from text; null = no amount ("לפי הטעם"). */
  qty: number | null;
  /** A UNITS key, or null = pieces. */
  unit: string | null;
  /** The ingredient without amount and unit. */
  name: string;
  /** For nutrition: estimated from qty + unit, editable. */
  grams: number | null;
  link: Link | null;
  /** The shopping product for 🛒 when it isn't the link (an MoH-linked line). */
  key: string | null;
  /** The line before conversion ("2 cups all-purpose flour"). */
  orig: string | null;
  /** A substitution note ("heavy cream → שמנת מתוקה 38%"). */
  alt: string | null;
  /** link/key were picked by the server and not checked yet. */
  auto: boolean;
}

export interface Recipe {
  id: string;
  owner: string;
  /** The owner's display name (feed). */
  ownerName?: string;
  name: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  prepMin: number | null;
  cookMin: number | null;
  photo: string | null;
  notes: string;
  source: { url: string | null; by: string | null } | null;
  shared: { at: string } | null;
  copiedFrom: { id: string; owner: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** A card in the book or the feed. */
export type RecipeSummary = Pick<Recipe, 'id' | 'owner' | 'ownerName' | 'name' | 'servings' | 'tags' | 'prepMin' | 'cookMin' | 'photo' | 'shared' | 'updatedAt'> & {
  kcal: number | null;
  partial: boolean;
  ingredientNames: string[];
};

export const LIMITS = {
  name: 120, servingsMax: 100, ingredients: 60, ingredientText: 200, steps: 40, stepText: 1000,
  tags: 10, tagText: 30, minutes: 1440, notes: 2000,
} as const;
