// Domain types + category registry + scoring for the /mekafkefim coffee
// journal. Mirrors src/types/coffee-order.ts: string-literal union, an option
// array the UI maps over, and a resolve* helper the API uses so a stale or
// malicious client can't smuggle bad values into Mongo.
//
// This file must stay import-free: src/lib/__tests__/coffee-score.test.ts
// imports it relatively for `node --test`, whose type-stripping can't resolve
// the `@/…` path alias.

export type CoffeeCategory =
  | 'coffee' | 'food' | 'pastry' | 'atmosphere' | 'price';

// The eight numeric rating fields, split out of CoffeeReview so the category
// registry can type its field pointers as `keyof` rather than `string`.
export interface CoffeeReviewRatings {
  tomCoffeeRating: number;
  tomFoodRating: number;
  tomAtmosphereRating: number;
  tomPriceRating: number;
  tomerCoffeeRating: number;
  tomerFoodRating: number;
  tomerAtmosphereRating: number;
  tomerPriceRating: number;
  tomPastryRating: number;
  tomerPastryRating: number;
}

export interface CoffeeCategoryDef {
  id: CoffeeCategory;
  label: string; // Hebrew — the page UI is Hebrew/RTL. ids stay English.
  tomField: keyof CoffeeReviewRatings;
  tomerField: keyof CoffeeReviewRatings;
}

// The single source of truth for what gets rated. Both forms and the review
// card map over this instead of hand-writing four near-identical blocks.
export const COFFEE_CATEGORIES: readonly CoffeeCategoryDef[] = [
  { id: 'coffee',     label: 'קפה',    tomField: 'tomCoffeeRating',     tomerField: 'tomerCoffeeRating'     },
  { id: 'food',       label: 'אוכל',   tomField: 'tomFoodRating',       tomerField: 'tomerFoodRating'       },
  { id: 'pastry',     label: 'מאפים',  tomField: 'tomPastryRating',     tomerField: 'tomerPastryRating'     },
  { id: 'atmosphere', label: 'אווירה', tomField: 'tomAtmosphereRating', tomerField: 'tomerAtmosphereRating' },
  { id: 'price',      label: 'שווי',   tomField: 'tomPriceRating',      tomerField: 'tomerPriceRating'      },
];

export interface CoffeeReview extends CoffeeReviewRatings {
  id: string;
  placeName: string;
  // Categories this place doesn't have at all (a café with no kitchen).
  // Absent on every document written before this field existed, and absent
  // reads as [] — nothing disabled, i.e. the historic behaviour.
  disabledCategories?: CoffeeCategory[];
  photoUrl?: string;
  mapsUrl?: string;
  instagramUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCoffeeReviewDto extends CoffeeReviewRatings {
  placeName: string;
  disabledCategories?: CoffeeCategory[];
  photoUrl?: string;
  mapsUrl?: string;
  instagramUrl?: string;
}

const CATEGORY_IDS = new Set<string>(COFFEE_CATEGORIES.map((c) => c.id));

// Missing/null → [] (payloads and documents that predate the field); a valid
// array → itself, de-duplicated; anything else → null, which the API turns
// into a 400. Same contract as resolveSource/resolveCapsule in coffee-order.ts.
export function resolveDisabledCategories(v: unknown): CoffeeCategory[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;

  const out: CoffeeCategory[] = [];
  for (const item of v) {
    if (typeof item !== 'string' || !CATEGORY_IDS.has(item)) return null;
    const id = item as CoffeeCategory;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// ─── Scoring ────────────────────────────────────────────────────────────────
// One implementation, used by the API sort, the list page and the card. Before
// this existed there were three that disagreed with each other.

export type ScorableReview = Partial<CoffeeReviewRatings> & {
  disabledCategories?: CoffeeCategory[];
};

export interface CategoryScore {
  id: CoffeeCategory;
  label: string;
  tom: number;       // 0 when not rated
  tomer: number;     // 0 when not rated
  combined: number;  // 0 when neither reviewer rated it
  disabled: boolean;
}

export interface ReviewScores {
  // Always all four, in COFFEE_CATEGORIES order, so the card can render a
  // disabled ring in its grid position instead of reflowing.
  categories: CategoryScore[];
  tom: number;
  tomer: number;
  combined: number;
}

// Mean of the values that count. `0` means "not rated" and never counts — the
// rule the page and the card each implemented separately as `nonZeroAvg`.
// Returns 0, not NaN, when nothing counts.
function meanOfRated(values: number[]): number {
  const rated = values.filter((v) => v > 0);
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
}

export function scoreReview(review: ScorableReview): ReviewScores {
  const disabled = review.disabledCategories ?? [];

  const categories: CategoryScore[] = COFFEE_CATEGORIES.map((def) => {
    const isDisabled = disabled.includes(def.id);
    const tom = isDisabled ? 0 : review[def.tomField] ?? 0;
    const tomer = isDisabled ? 0 : review[def.tomerField] ?? 0;
    return {
      id: def.id,
      label: def.label,
      tom,
      tomer,
      combined: meanOfRated([tom, tomer]),
      disabled: isDisabled,
    };
  });

  const active = categories.filter((c) => !c.disabled);
  const tom = meanOfRated(active.map((c) => c.tom));
  const tomer = meanOfRated(active.map((c) => c.tomer));

  // Mean of the two reviewer averages — unchanged from the pre-existing
  // formula. Exclusion is per-place, so it hits both reviewers symmetrically
  // and no existing score shifts.
  return { categories, tom, tomer, combined: meanOfRated([tom, tomer]) };
}
