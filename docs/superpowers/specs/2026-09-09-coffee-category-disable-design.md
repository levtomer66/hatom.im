# Mekafkefim: Disable a Rating Category Per Place — Design

**Date:** 2026-09-09
**Status:** Approved

## Goal

Some cafés don't serve food. Some don't have an atmosphere worth scoring. Today
`/mekafkefim` averages all four categories (קפה / אוכל / אווירה / מחיר), so a
coffee-only place either gets a made-up food score that drags its rank down, or
a `0` that the card renders as an ambiguous `—`.

Give each **place** a way to mark a category as "not measured here" so it is
excluded from that place's overall score, and so the card says *why* the
category is blank.

## Current state

The read path already excludes categories — the write path can't reach it:

- `nonZeroAvg()` drops any `0` before averaging. It exists in **two** copies:
  `src/app/mekafkefim/page.tsx:63` and `src/components/CoffeeReviewCard.tsx:22`.
  The page footer already advertises `0 = לא דורג`.
- `ScaleBar` is `min="1"` (`src/components/RatingStars.tsx:68`). Both forms
  start every rating at `0`, but once a slider is touched it can never return
  to `0`. The escape hatch is unreachable.
- `src/app/api/coffee-reviews/route.ts:16-30` sorts by a naive `/4` average
  that **includes** zeros, contradicting the client, which then re-sorts with
  `nonZeroAvg`. The server sort is effectively dead and wrong.

So this is mostly "give the existing hole a real door", plus one modelling
decision.

## Decisions

1. **Per place, not per reviewer.** One flag per place per category: "this café
   has no food". It hides the slider for both Tom and Tomer and drops the
   category from the overview, from Tom's average, and from Tomer's average.
   Rejected the per-reviewer alternative ("I only had coffee") — it doubles the
   flags to eight and forces the overview to invent a rule for when the two
   reviewers disagree about whether a category exists.
2. **Card shows a greyed ring labelled `אין`.** Not hidden. The 4-ring grid
   stays stable across cards, and `אין` (no food here) becomes visually
   distinct from `—` (nobody has rated it yet) — a distinction the card cannot
   make today.
3. **Control sits at place level, above the תום/תומר tabs**, with the place's
   other shared fields (name, map, photo), so its per-place scope is
   self-evident. An inline `✕` next to each slider was rejected: it would sit
   inside one reviewer's tab while silently changing the other's.

## Approach

`disabledCategories: CoffeeCategory[]` on the review document, plus a canonical
category registry and one scoring function in `src/types/coffee.ts`.

Two alternatives were rejected:

- **Sentinel `-1` in the existing eight rating fields.** No new field, but it
  stores a *per-place* fact in *per-reviewer* slots — you would write `-1`
  twice and hope they stay in sync — and it overwrites the real rating, so
  un-disabling loses it.
- **Four booleans (`foodDisabled`, …).** Matches the existing flat-field style
  and needs no union type, but without a registry the four hand-written slider
  blocks and four ring literals stay hand-written. The duplication that makes
  this feature tedious would survive it.

Logic lives in `src/types/coffee.ts`, not a new `src/lib/` module, because
that is the tested pattern in this repo: `src/lib/__tests__/workout-freestyle.test.ts:7`
imports `../../types/workout.ts`, `src/types/workout.ts` has zero imports, and
no module under `src/lib/` uses relative imports. Node's type-stripping only
resolves relative `.ts` paths, so an import-free types file is the shape that
is provably testable. It is also what `src/types/coffee-order.ts` already does
(union + option array + `resolve*` validators + label/summary helpers).

## Changes

### `src/types/coffee.ts`

```ts
export type CoffeeCategory = 'coffee' | 'food' | 'atmosphere' | 'price';

export interface CoffeeCategoryDef {
  id: CoffeeCategory;
  label: string;                        // Hebrew — the UI label
  tomField: keyof CoffeeReviewRatings;  // e.g. 'tomFoodRating'
  tomerField: keyof CoffeeReviewRatings;
}

export const COFFEE_CATEGORIES: readonly CoffeeCategoryDef[] = [
  { id: 'coffee',     label: 'קפה',    tomField: 'tomCoffeeRating',     tomerField: 'tomerCoffeeRating'     },
  { id: 'food',       label: 'אוכל',   tomField: 'tomFoodRating',       tomerField: 'tomerFoodRating'       },
  { id: 'atmosphere', label: 'אווירה', tomField: 'tomAtmosphereRating', tomerField: 'tomerAtmosphereRating' },
  { id: 'price',      label: 'מחיר',   tomField: 'tomPriceRating',      tomerField: 'tomerPriceRating'      },
];
```

`CoffeeReviewRatings` is the eight-numeric-field subset that both `CoffeeReview`
and `CreateCoffeeReviewDto` already carry; extracting it is what lets
`tomField`/`tomerField` be typed as `keyof` instead of a bare `string`.

- `disabledCategories?: CoffeeCategory[]` added to `CoffeeReview` and
  `CreateCoffeeReviewDto`.
- `resolveDisabledCategories(v: unknown): CoffeeCategory[] | null` — missing or
  `null` → `[]`; an array of known ids → that array, de-duplicated; anything
  else (not an array, unknown id, non-string member) → `null`, which the API
  turns into a 400. Same contract as `resolveSource` / `resolveCapsule`.
- `scoreReview(review): ReviewScores` — the single scoring implementation:

```ts
export interface CategoryScore {
  id: CoffeeCategory;
  label: string;
  tom: number;       // 0 when not rated
  tomer: number;     // 0 when not rated
  combined: number;  // 0 when neither reviewer rated it
  disabled: boolean;
}

export interface ReviewScores {
  categories: CategoryScore[];  // always all four, in COFFEE_CATEGORIES order
  tom: number;                  // 0 when nothing counts
  tomer: number;
  combined: number;
}
```

Rules:

- A category is excluded outright if its id is in `disabledCategories`.
- Inside an **active** category, `0` (or missing) still means "not rated" and is
  still excluded — today's `nonZeroAvg` behaviour, preserved.
- Reviewer average = mean over active categories with a non-zero value **for
  that reviewer**.
- `combined` = mean of the reviewer averages that are `> 0`. **Formula
  unchanged from today.** Because exclusion is per-place it hits both reviewers
  symmetrically, so no existing score shifts.
- All four categories disabled, or nothing rated → `combined = 0`, which the
  card already renders as `לא דורג` and which sorts last. Same terminal state
  as an unrated place today.

`categories` always returns all four entries so the card can render a disabled
ring in its correct grid position rather than reflowing.

### Storage / migration

None. `disabledCategories` absent reads as `[]`, so **every existing document
scores and sorts exactly as it does today.** `updateCoffeeReview`'s
`$set: {...data}` already carries the new field; `ensureRatingFormat` in
`src/models/CoffeeReview.ts` needs no change — it only backfills the legacy
`coffeeRating`/`foodRating` shape and is orthogonal to this.

**Disabling never destroys ratings.** The eight stored numbers are left alone
and merely ignored, so un-ticking `אוכל` restores the previous 7.5. This is the
main reason the `-1` sentinel was rejected.

### API routes

`src/app/api/coffee-reviews/route.ts`

- `POST`: run `data.disabledCategories` through `resolveDisabledCategories`;
  `null` → `400 { error: 'Invalid disabledCategories' }`. Persist the resolved
  array.
- `GET`: replace the naive `/4` sort at lines 16-30 with
  `scoreReview(r).combined`, descending. Server and page then agree on order
  instead of contradicting each other.

`src/app/api/coffee-reviews/[id]/route.ts`

- `PATCH`: same validation, and only when the key is present in the body — an
  absent `disabledCategories` must stay absent rather than being reset to `[]`,
  so partial patches that touch only e.g. `photoUrl` don't silently re-enable
  categories.

### `src/components/AddCoffeeReviewForm.tsx` + `EditCoffeeReviewForm.tsx`

- New `disabledCategories` state (`[]` for add; `review.disabledCategories ?? []`
  for edit), sent in the request body.
- A place-level pill row above the תום/תומר tabs, under the photo/map/instagram
  inputs, headed `מה לא נמדד במקום הזה?` — one toggle pill per
  `COFFEE_CATEGORIES` entry. Ticked = excluded.
- The four hand-written slider blocks (`EditCoffeeReviewForm.tsx:113-165` and
  its twin in the add form) collapse into one map over
  `COFFEE_CATEGORIES.filter(c => !disabledCategories.includes(c.id))`, so a
  disabled category's slider disappears from both reviewer tabs at once. Around
  50 lines removed per form, and the feature falls out of the registry for free.
- Guard: disabling all four is allowed (a place can be a pure landmark) and
  simply yields `לא דורג`. No validation error.

### `src/components/CoffeeReviewCard.tsx`

- Drop the local `nonZeroAvg`; derive every number from `scoreReview(review)`.
- `ScoreRing` gains a `disabled` prop: dashed grey ring, no progress arc, and an
  empty centre (no number, not even the `—` glyph). The caption below the ring
  becomes two lines — `אין` on top, the category name (`אוכל`) beneath — so the
  reader sees both that the category is absent and which one it was. Visually
  distinct from an active-but-unrated category, which keeps today's single-line
  caption and a `—` in the ring centre.
- The three ring rows (overview / תום / תומר) read from `ReviewScores.categories`
  instead of three hand-written literals at lines 66-83.

### `src/app/mekafkefim/page.tsx`

- Drop the local `nonZeroAvg` and the inline `getAvg`; sort by
  `scoreReview(r).combined`.
- Footer note (line 224) extended to explain the new state, e.g.
  `… · 0 = לא דורג · קטגוריות מושבתות לא נספרות`.

## Non-goals

- **`ScaleBar`'s `min="1"` stays.** Un-rating through the slider was the wrong
  door; an explicit per-place switch is the right one, and `min=1` keeps a
  rating from being nulled by a stray drag. Recorded here so it doesn't read as
  an oversight.
- No per-reviewer N/A (decision 1).
- No new categories, and no user-defined categories. `COFFEE_CATEGORIES` stays
  a fixed four-entry constant.

## Tests

New `src/lib/__tests__/coffee-score.test.ts`, importing `../../types/coffee.ts`
(the `workout-freestyle.test.ts` pattern), run by `npm test` under `node --test`:

- **Regression guard:** a fully-rated review with no `disabledCategories`
  produces the same `tom` / `tomer` / `combined` numbers as today's
  `nonZeroAvg` chain.
- A legacy document with the field absent is identical to `[]`.
- `food` disabled → each reviewer's average is the mean of the other three, and
  `combined` follows.
- `food` disabled **while food values are still stored** → those values are
  ignored, proving disable doesn't rely on zeroing.
- A `0` inside an active category is still excluded from that category and from
  the reviewer average.
- A category rated by only one reviewer → its `combined` is that reviewer's
  score alone (today's behaviour).
- All four disabled → `combined === 0` and `categories` still has four entries,
  all `disabled: true`.
- `resolveDisabledCategories`: `undefined`/`null` → `[]`; `['food']` → `['food']`;
  `['food','food']` → `['food']`; `['nope']`, `'food'`, `42` → `null`.

## Verification

Per `CLAUDE.md`: `npx tsc --noEmit --incremental false --pretty false`,
`npm run lint`, `npm test`, `npm run build`. Live data can't be checked from
this machine (local Mongo credentials are stale), so the ranking change is
confirmed against the unit tests plus a manual pass on the production deploy
after shipping.
