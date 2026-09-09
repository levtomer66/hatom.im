# Mekafkefim Per-Place Category Disable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each café on `/mekafkefim` mark a rating category (קפה / אוכל / אווירה / מחיר) as "not measured here" so it is excluded from that place's overall score, and so the card shows `אין` instead of an ambiguous `—`.

**Architecture:** A `disabledCategories: CoffeeCategory[]` array on the review document, plus a canonical category registry (`COFFEE_CATEGORIES`) and a single scoring function (`scoreReview()`) in `src/types/coffee.ts`. That one function replaces three divergent implementations that exist today — `nonZeroAvg` in the page, a second copy in the card, and a naive `/4` sort in the API that counts zeros. The forms and the card then map over the registry instead of hand-writing four near-identical blocks each.

**Tech Stack:** Next.js 15 App Router, TypeScript, MongoDB (typed-function models, no ODM), `node:test` for pure helpers, Tailwind classes in the forms and inline styles in the card (both pre-existing — do not unify them).

**Source spec:** `docs/superpowers/specs/2026-09-09-coffee-category-disable-design.md`

## Global Constraints

- **No Mongo migration.** `disabledCategories` absent MUST read as `[]`, so every existing document scores and sorts exactly as it does today.
- **The `combined` formula does not change.** Reviewer average = mean of that reviewer's rated, active categories; combined = mean of the two reviewer averages that are `> 0`. Exclusion is per-place, so it hits both reviewers symmetrically.
- **Two distinct blank states.** A rating of `0` = *not rated yet* (renders `—`). A category in `disabledCategories` = *not measured here* (renders `אין`). Both are excluded from averages.
- **Disabling never clears stored ratings.** The eight numeric fields are left untouched and merely ignored, so un-ticking a category restores its previous score.
- **`src/types/coffee.ts` must stay import-free.** Node's type-stripping runs the test via a relative `.ts` import; any `@/…` import in that file breaks `npm test`. It currently has zero imports — keep it that way.
- **`ScaleBar`'s `min="1"` stays** (`src/components/RatingStars.tsx:68`). Explicit non-goal, not an oversight.
- **Hebrew UI copy**, exact strings given per task. Category ids stay English (they are the stored values).
- No new external origins, so **`next.config.js` CSP is untouched**.
- Permission gates (`mekafkefim:write` on POST/PATCH/DELETE) are already correct — **do not modify them**.
- Per `CLAUDE.md`: the Husky pre-commit hook runs `npm test` then `next build`, so every commit below self-verifies and will take a minute. If it fails with `Cannot find module for page: /_document`, `rm -rf .next` and retry.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/types/coffee.ts` | Modify (59 lines → ~180) | Domain types **and** all pure logic: category registry, `resolveDisabledCategories`, `scoreReview`. Import-free so it stays testable. Mirrors `src/types/coffee-order.ts` (union + option array + `resolve*` validators + helpers) and `src/types/workout.ts` (pure helper living in the types file). |
| `src/lib/__tests__/coffee-score.test.ts` | Create | `node:test` coverage for the registry + scoring, including a regression guard that today's numbers don't shift. |
| `src/app/api/coffee-reviews/route.ts` | Modify | `GET` sorts by `scoreReview`; `POST` validates and persists the new field. |
| `src/app/api/coffee-reviews/[id]/route.ts` | Modify | `PATCH` validates the field only when the client sent it. |
| `src/components/CoffeeReviewCard.tsx` | Modify | Renders from `scoreReview`; `ScoreRing` gains a `disabled` state. |
| `src/app/mekafkefim/page.tsx` | Modify | Sorts by `scoreReview`; footer explains the two blank states. |
| `src/components/AddCoffeeReviewForm.tsx` | Modify | Place-level pill row + registry-driven sliders. |
| `src/components/EditCoffeeReviewForm.tsx` | Modify | Same, seeded from the existing review. |
| `CLAUDE.md` | Modify | Records the load-bearing invariants for future sessions. |

`src/models/CoffeeReview.ts` is deliberately **not** in this list. Its `updateCoffeeReview` does `$set: {...data}`, which already carries the new field, and `ensureRatingFormat` only backfills the legacy `coffeeRating`/`foodRating` shape — orthogonal to this work. Leave it alone.

---

### Task 1: Category registry + scoring in `src/types/coffee.ts`

**Files:**
- Modify: `src/types/coffee.ts` (whole file; currently 59 lines)
- Test: `src/lib/__tests__/coffee-score.test.ts` (create)

**Interfaces:**
- Consumes: nothing — this is the foundation task.
- Produces, all exported from `src/types/coffee.ts`:
  - `type CoffeeCategory = 'coffee' | 'food' | 'atmosphere' | 'price'`
  - `interface CoffeeReviewRatings` — the eight numeric fields
  - `interface CoffeeCategoryDef { id: CoffeeCategory; label: string; tomField: keyof CoffeeReviewRatings; tomerField: keyof CoffeeReviewRatings }`
  - `const COFFEE_CATEGORIES: readonly CoffeeCategoryDef[]` — always four entries, in display order
  - `type ScorableReview = Partial<CoffeeReviewRatings> & { disabledCategories?: CoffeeCategory[] }`
  - `interface CategoryScore { id: CoffeeCategory; label: string; tom: number; tomer: number; combined: number; disabled: boolean }`
  - `interface ReviewScores { categories: CategoryScore[]; tom: number; tomer: number; combined: number }`
  - `function resolveDisabledCategories(v: unknown): CoffeeCategory[] | null`
  - `function scoreReview(review: ScorableReview): ReviewScores`
  - `disabledCategories?: CoffeeCategory[]` added to `CoffeeReview` and `CreateCoffeeReviewDto`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/coffee-score.test.ts`. Note the relative `.ts` import — that is required by Node's type-stripping and is the same pattern as `src/lib/__tests__/workout-freestyle.test.ts:7`. Every expected number below is exact in binary floating point (halves and quarters only), which is why `assert.equal` is safe here; if you change a fixture number, keep that property.

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COFFEE_CATEGORIES,
  resolveDisabledCategories,
  scoreReview,
  type CoffeeCategory,
  type ScorableReview,
} from '../../types/coffee.ts';

// tom:   8, 4, 7, 9  → all four 7.0    · without food 8.0
// tomer: 9, 2, 6, 9  → all four 6.5    · without food 8.0
const RATED: ScorableReview = {
  tomCoffeeRating: 8,
  tomFoodRating: 4,
  tomAtmosphereRating: 7,
  tomPriceRating: 9,
  tomerCoffeeRating: 9,
  tomerFoodRating: 2,
  tomerAtmosphereRating: 6,
  tomerPriceRating: 9,
};

const byId = (s: ReturnType<typeof scoreReview>, id: CoffeeCategory) =>
  s.categories.find((c) => c.id === id)!;

test('the registry is the four categories in display order', () => {
  assert.deepEqual(
    COFFEE_CATEGORIES.map((c) => c.id),
    ['coffee', 'food', 'atmosphere', 'price'],
  );
  assert.deepEqual(
    COFFEE_CATEGORIES.map((c) => c.label),
    ['קפה', 'אוכל', 'אווירה', 'מחיר'],
  );
});

test('regression: a fully-rated review with nothing disabled scores as it did before', () => {
  const s = scoreReview(RATED);
  assert.equal(s.tom, 7);
  assert.equal(s.tomer, 6.5);
  assert.equal(s.combined, 6.75);
  assert.equal(byId(s, 'coffee').combined, 8.5);
  assert.equal(byId(s, 'food').combined, 3);
  assert.equal(s.categories.length, 4);
  assert.ok(s.categories.every((c) => !c.disabled));
});

test('a legacy document with no disabledCategories field is identical to an empty array', () => {
  assert.deepEqual(scoreReview(RATED), scoreReview({ ...RATED, disabledCategories: [] }));
});

test('disabling food drops it from both reviewers and from the combined score', () => {
  const s = scoreReview({ ...RATED, disabledCategories: ['food'] });
  assert.equal(s.tom, 8);
  assert.equal(s.tomer, 8);
  assert.equal(s.combined, 8);

  const food = byId(s, 'food');
  assert.equal(food.disabled, true);
  assert.equal(food.tom, 0);
  assert.equal(food.tomer, 0);
  assert.equal(food.combined, 0);

  // The grid stays four wide so the card can render the ring in place.
  assert.equal(s.categories.length, 4);
  assert.equal(byId(s, 'coffee').disabled, false);
});

test('disabling ignores stored ratings rather than depending on them being zeroed', () => {
  const stillStored = scoreReview({ ...RATED, disabledCategories: ['food'] });
  const zeroed = scoreReview({
    ...RATED,
    tomFoodRating: 0,
    tomerFoodRating: 0,
    disabledCategories: ['food'],
  });
  assert.deepEqual(stillStored, zeroed);
});

test('a zero inside an active category still means "not rated yet"', () => {
  const s = scoreReview({ ...RATED, tomFoodRating: 0 });
  assert.equal(s.tom, 8);      // 8, 7, 9 — the 0 is skipped
  assert.equal(s.tomer, 6.5);  // unchanged
  assert.equal(s.combined, 7.25);

  const food = byId(s, 'food');
  assert.equal(food.disabled, false);  // NOT the same state as disabled
  assert.equal(food.combined, 2);      // only Tomer's 2 counts
});

test('all four disabled scores as unrated', () => {
  const s = scoreReview({
    ...RATED,
    disabledCategories: ['coffee', 'food', 'atmosphere', 'price'],
  });
  assert.equal(s.tom, 0);
  assert.equal(s.tomer, 0);
  assert.equal(s.combined, 0);
  assert.equal(s.categories.length, 4);
  assert.ok(s.categories.every((c) => c.disabled));
});

test('an empty review scores zero rather than NaN', () => {
  const s = scoreReview({});
  assert.equal(s.tom, 0);
  assert.equal(s.tomer, 0);
  assert.equal(s.combined, 0);
});

test('resolveDisabledCategories defaults, de-dupes, and rejects', () => {
  assert.deepEqual(resolveDisabledCategories(undefined), []);
  assert.deepEqual(resolveDisabledCategories(null), []);
  assert.deepEqual(resolveDisabledCategories([]), []);
  assert.deepEqual(resolveDisabledCategories(['food']), ['food']);
  assert.deepEqual(resolveDisabledCategories(['food', 'food']), ['food']);
  assert.deepEqual(resolveDisabledCategories(['price', 'coffee']), ['price', 'coffee']);

  assert.equal(resolveDisabledCategories(['nope']), null);
  assert.equal(resolveDisabledCategories('food'), null);
  assert.equal(resolveDisabledCategories(42), null);
  assert.equal(resolveDisabledCategories([1]), null);
  assert.equal(resolveDisabledCategories({ food: true }), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL. Node reports it cannot resolve the named imports from `../../types/coffee.ts` — `COFFEE_CATEGORIES`, `resolveDisabledCategories` and `scoreReview` do not exist yet. (`node --test` globs `src/**/*.test.ts`, so the new file is picked up automatically; the three existing workout suites must still pass.)

- [ ] **Step 3: Write the implementation**

Replace the whole of `src/types/coffee.ts` with the following. `CoffeeReview` and `CreateCoffeeReviewDto` now extend the extracted `CoffeeReviewRatings`, which is what lets the registry type its field pointers as `keyof` instead of bare strings. Keep the file import-free.

```ts
// Domain types + category registry + scoring for the /mekafkefim coffee
// journal. Mirrors src/types/coffee-order.ts: string-literal union, an option
// array the UI maps over, and a resolve* helper the API uses so a stale or
// malicious client can't smuggle bad values into Mongo.
//
// This file must stay import-free: src/lib/__tests__/coffee-score.test.ts
// imports it relatively for `node --test`, whose type-stripping can't resolve
// the `@/…` path alias.

export type CoffeeCategory = 'coffee' | 'food' | 'atmosphere' | 'price';

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
  { id: 'atmosphere', label: 'אווירה', tomField: 'tomAtmosphereRating', tomerField: 'tomerAtmosphereRating' },
  { id: 'price',      label: 'מחיר',   tomField: 'tomPriceRating',      tomerField: 'tomerPriceRating'      },
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
```

Note the replacement drops the old `ReviewerScores` and `CombinedReviewScores` interfaces (lines 40-59 of the original file) — `ReviewScores` supersedes them, and nothing imported them. Confirm that:

Run: `grep -rn "ReviewerScores\|CombinedReviewScores" src/`
Expected: no output. If anything appears, it was dead code referencing them — read it before continuing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all nine new tests plus the three existing workout suites.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --incremental false --pretty false`
Expected: no output. `src/models/CoffeeReview.ts` uses `Omit<CoffeeReview, 'id'>`, which keeps working now that `CoffeeReview` extends an interface — if this errors, do not widen the model; re-check the `extends` chain.

- [ ] **Step 6: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): category registry + single scoreReview()"
```

---

### Task 2: API — validate the field, and fix the sort that contradicts the client

**Files:**
- Modify: `src/app/api/coffee-reviews/route.ts` (`GET` sort at lines 16-30; `POST` at lines 45-106)
- Modify: `src/app/api/coffee-reviews/[id]/route.ts` (`PATCH` at lines 36-88)

**Interfaces:**
- Consumes: `resolveDisabledCategories`, `scoreReview` from `@/types/coffee` (Task 1).
- Produces: `GET /api/coffee-reviews` ordered by `scoreReview().combined` descending; `POST` and `PATCH` reject an invalid `disabledCategories` with `400 { error: 'Invalid disabledCategories' }`.

Line numbers are pre-change. Note these routes use the `@/` alias — that is correct here; only `src/types/coffee.ts` itself must stay import-free.

- [ ] **Step 1: Fix the GET sort**

In `src/app/api/coffee-reviews/route.ts`, extend the import:

```ts
import { CreateCoffeeReviewDto, resolveDisabledCategories, scoreReview } from '@/types/coffee';
```

Then replace the whole sort block (lines 16-30, from `// Sort by average combined rating` through the closing `});`) with:

```ts
    // Same ordering the page uses. The previous version divided by 4 and
    // counted unrated zeros, so it disagreed with the client on every review
    // that wasn't fully rated.
    const sortedReviews = reviews.sort(
      (a, b) => scoreReview(b).combined - scoreReview(a).combined
    );
```

- [ ] **Step 2: Validate and persist on POST**

In the same file, inside `POST`, after the existing `allRatings` range check (the block ending with the `'Ratings must be between 0 and 10 with 0.5 increments'` response) and immediately before `const newReview = await createCoffeeReview(data);`, insert:

```ts
    const disabledCategories = resolveDisabledCategories(data.disabledCategories);
    if (disabledCategories === null) {
      return NextResponse.json(
        { error: 'Invalid disabledCategories' },
        { status: 400 }
      );
    }
```

and change the create call to persist the resolved array:

```ts
    const newReview = await createCoffeeReview({ ...data, disabledCategories });
```

- [ ] **Step 3: Validate on PATCH**

In `src/app/api/coffee-reviews/[id]/route.ts`, add the import:

```ts
import { resolveDisabledCategories } from '@/types/coffee';
```

Inside `PATCH`, after the existing `allRatings` range check and before `const updatedReview = await updateCoffeeReview(id, data);`, insert:

```ts
    // Only touch the field when the client actually sent it — a patch that
    // changes just photoUrl must not silently re-enable categories.
    if ('disabledCategories' in data) {
      const resolved = resolveDisabledCategories(data.disabledCategories);
      if (resolved === null) {
        return NextResponse.json(
          { error: 'Invalid disabledCategories' },
          { status: 400 }
        );
      }
      data.disabledCategories = resolved;
    }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint`
Expected: no type errors, no new lint warnings.

Then confirm no other caller depended on the old sort:

Run: `grep -rn "api/coffee-reviews" src/ --include=*.tsx --include=*.ts`
Expected: only `src/app/mekafkefim/page.tsx` (fetch, delete) and the route files themselves. If anything else appears, read it before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/coffee-reviews/route.ts "src/app/api/coffee-reviews/[id]/route.ts"
git commit -m "feat(mekafkefim): validate disabledCategories; sort API by scoreReview"
```

---

### Task 3: Read path — disabled ring on the card, `scoreReview` sort on the page

**Files:**
- Modify: `src/components/CoffeeReviewCard.tsx` (`nonZeroAvg` at 22-25; `ScoreRing` at 27-53; score derivation at 60-85; ring render at 231-233)
- Modify: `src/app/mekafkefim/page.tsx` (`nonZeroAvg` at 63-66; `sortedReviews` at 68-75; footer at 221-227)

**Interfaces:**
- Consumes: `scoreReview` from `@/types/coffee` (Task 1).
- Produces: a card that renders a dashed grey ring with an `אין` caption for disabled categories, and a list ordered identically to the API.

- [ ] **Step 1: Give `ScoreRing` a disabled state**

In `src/components/CoffeeReviewCard.tsx`, delete the local `nonZeroAvg` (lines 22-25) and add `scoreReview` to the existing type import:

```ts
import { CoffeeReview, scoreReview } from '@/types/coffee';
```

Replace the whole `ScoreRing` component (lines 27-53) with:

```tsx
// SVG ring gauge for a score. Three states: rated (coloured arc + number),
// active-but-unrated (empty ring + "—"), and disabled (dashed grey ring, empty
// centre, and an "אין" line above the category name — the place doesn't have
// this category at all).
const ScoreRing = ({
  score,
  label,
  size = 72,
  disabled = false,
}: { score: number; label: string; size?: number; disabled?: boolean }) => {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const fill = score > 0 ? (score / 10) * circ : 0;
  const gap = circ - fill;
  const colors = score >= 8 ? '#5a7a3a' : score >= 6 ? '#8a6020' : score >= 4 ? '#c04020' : '#aaa';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={disabled ? '#d0c4a8' : '#e8ddc8'} strokeWidth="4"
          strokeDasharray={disabled ? '3 5' : undefined}
        />
        {!disabled && score > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors} strokeWidth="4"
            strokeDasharray={`${fill} ${gap}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        )}
        {!disabled && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
            style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontFamily: 'monospace', fontSize: size * 0.22 + 'px', fill: score > 0 ? '#3a2c1a' : '#bba', fontWeight: 700 }}>
            {score > 0 ? score.toFixed(1) : '—'}
          </text>
        )}
      </svg>
      {/* minHeight keeps all four columns the same height whether or not a
          category is disabled, so the ring grid never jumps. */}
      <div style={{ minHeight: '26px', textAlign: 'center' }}>
        {disabled && (
          <span style={{ display: 'block', fontSize: '10px', color: '#a09070', letterSpacing: '0.08em', fontFamily: 'monospace', fontWeight: 700 }}>
            אין
          </span>
        )}
        <span style={{ display: 'block', fontSize: '10px', color: disabled ? '#b0a488' : '#8a7a60', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          {label}
        </span>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Derive every card number from `scoreReview`**

Replace lines 60-85 (from `const tomAvg = …` through `const rings = activeTab === 'overview' ? …`) with:

```tsx
  const scores = scoreReview(review);
  const tomAvg = scores.tom;
  const tomerAvg = scores.tomer;
  const combinedAvg = scores.combined;

  // One list instead of three hand-written literals; the tab picks which
  // number to show and `disabled` rides along unchanged.
  const rings = scores.categories.map((c) => ({
    label: c.label,
    disabled: c.disabled,
    score: activeTab === 'overview' ? c.combined : activeTab === 'tom' ? c.tom : c.tomer,
  }));
```

Then update the ring render (line 232) to pass the flag:

```tsx
          {rings.map(r => <ScoreRing key={r.label} score={r.score} label={r.label} disabled={r.disabled} size={62} />)}
```

Everything downstream (`combinedAvg > 0 ? … : לא דורג`, the `tomAvg`/`tomerAvg` footer row) keeps working unchanged, because the names and semantics are the same.

- [ ] **Step 3: Sort the page through `scoreReview` and explain the two blank states**

In `src/app/mekafkefim/page.tsx`, add `scoreReview` to the existing import:

```ts
import { CoffeeReview, scoreReview } from '@/types/coffee';
```

Delete the local `nonZeroAvg` (lines 63-66) and replace the whole `sortedReviews` block (lines 68-75) with:

```tsx
  const sortedReviews = [...reviews].sort(
    (a, b) => scoreReview(b).combined - scoreReview(a).combined
  );
```

Update the footer note (line 224) so the card's two blank states are legible:

```tsx
              {reviews.length} בתי קפה · מיוין לפי דירוג ממוצע · 0 = לא דורג · &quot;אין&quot; = לא נמדד במקום
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint && npm test`
Expected: clean; the Task 1 suites still pass.

Then confirm both duplicate implementations are gone:

Run: `grep -rn "nonZeroAvg" src/`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/CoffeeReviewCard.tsx src/app/mekafkefim/page.tsx
git commit -m "feat(mekafkefim): render disabled categories as אין; score via scoreReview"
```

---

### Task 4: Forms — place-level pill row, registry-driven sliders

**Files:**
- Modify: `src/components/AddCoffeeReviewForm.tsx` (state at 10-28; payload at 50-66; reset at 154-169; `renderRatingForm` at 100-175; JSX before the tabs at ~245)
- Modify: `src/components/EditCoffeeReviewForm.tsx` (state at 19-37; payload at 59-75; `renderRatingForm` at 94-168; JSX before the tabs at ~253)

**Interfaces:**
- Consumes: `COFFEE_CATEGORIES`, `type CoffeeCategory` from `@/types/coffee` (Task 1); `POST`/`PATCH` accepting `disabledCategories` (Task 2).
- Produces: the only writer of `disabledCategories`. No later task depends on it.

The two forms are near-identical by design and must stay in lockstep — do both in this one task. The edit form is the reference implementation below; the add form differs only in the three noted places.

- [ ] **Step 1: Add the state and the toggle (both forms)**

In `EditCoffeeReviewForm.tsx`, extend the import:

```ts
import { CoffeeReview, COFFEE_CATEGORIES, type CoffeeCategory } from '@/types/coffee';
```

After the `instagramUrl` state declaration, add:

```tsx
  // Per-place, not per-reviewer: a café with no kitchen has no food score for
  // either of us. Toggling one off removes its slider from BOTH tabs.
  const [disabledCategories, setDisabledCategories] = useState<CoffeeCategory[]>(
    review.disabledCategories ?? []
  );

  const toggleCategory = (id: CoffeeCategory) => {
    setDisabledCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };
```

In `AddCoffeeReviewForm.tsx` the same, except the initial value is `[]`:

```tsx
  const [disabledCategories, setDisabledCategories] = useState<CoffeeCategory[]>([]);
```

and its import has no `CoffeeReview` to extend, so add a new line:

```ts
import { COFFEE_CATEGORIES, type CoffeeCategory } from '@/types/coffee';
```

- [ ] **Step 2: Send the field (both forms)**

In each form's `JSON.stringify({…})` body, add the line immediately after `placeName,`:

```tsx
          disabledCategories,
```

In `AddCoffeeReviewForm.tsx` only, add to the post-success reset block (next to `setPhotoUrl('')`):

```tsx
      setDisabledCategories([]);
```

- [ ] **Step 3: Replace the four hand-written slider blocks with a registry map (both forms)**

Replace the whole body of `renderRatingForm` in each form — the per-reviewer setter/value consts and all four `<div><ScaleBar …/>…</div>` blocks — with:

```tsx
  const renderRatingForm = (reviewer: 'tom' | 'tomer') => {
    const displayName = reviewer === 'tom' ? 'תום' : 'תומר';

    const ratings: Record<CoffeeCategory, number> = reviewer === 'tom'
      ? { coffee: tomCoffeeRating, food: tomFoodRating, atmosphere: tomAtmosphereRating, price: tomPriceRating }
      : { coffee: tomerCoffeeRating, food: tomerFoodRating, atmosphere: tomerAtmosphereRating, price: tomerPriceRating };

    const setters: Record<CoffeeCategory, (v: number) => void> = reviewer === 'tom'
      ? { coffee: setTomCoffeeRating, food: setTomFoodRating, atmosphere: setTomAtmosphereRating, price: setTomPriceRating }
      : { coffee: setTomerCoffeeRating, food: setTomerFoodRating, atmosphere: setTomerAtmosphereRating, price: setTomerPriceRating };

    // A disabled category's stored rating is deliberately left alone — it is
    // just not shown and not scored, so un-ticking the pill brings it back.
    const active = COFFEE_CATEGORIES.filter((c) => !disabledCategories.includes(c.id));

    return (
      <div>
        <h3 className="text-xl font-bold text-amber-800 mb-4 text-center">הדירוג של {displayName}</h3>

        <div className="space-y-4 mb-6">
          {active.map((c) => (
            <div key={c.id}>
              <ScaleBar label={c.label} rating={ratings[c.id]} onChange={setters[c.id]} />
              {ratings[c.id] > 0 && (
                <div className="mt-1 flex justify-end">
                  <RatingStars rating={ratings[c.id]} size="sm" />
                </div>
              )}
            </div>
          ))}
          {active.length === 0 && (
            <p className="text-amber-600 text-center text-sm">כל הקטגוריות מושבתות במקום הזה</p>
          )}
        </div>
      </div>
    );
  };
```

- [ ] **Step 4: Add the place-level pill row (both forms)**

In each form's JSX, insert this block between the photo-url `<div>` and the `{/* Rating tabs */}` comment — i.e. with the place's other shared fields, above the reviewer tabs, so its per-place scope is self-evident:

```tsx
        {/* Place-level, deliberately above the reviewer tabs: this is a fact
            about the café, not about either reviewer's visit. */}
        <div>
          <label className="block text-amber-800 font-medium mb-2 text-right">
            מה לא נמדד במקום הזה?
          </label>
          <div className="flex flex-wrap gap-2 justify-end" dir="rtl">
            {COFFEE_CATEGORIES.map((c) => {
              const off = disabledCategories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={off}
                  className={`px-3 py-1 rounded-full border text-sm transition-colors duration-150 ${
                    off
                      ? 'bg-amber-700 border-amber-700 text-white'
                      : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {off ? `✓ ${c.label}` : c.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-amber-600 mt-1 text-right">
            מסומן = לא נספר בדירוג הכללי
          </p>
        </div>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint && npm test`
Expected: clean.

Then confirm both forms send the field, and that the hand-written slider blocks really are gone rather than merely supplemented:

Run: `grep -n "^\s*disabledCategories,$" src/components/AddCoffeeReviewForm.tsx src/components/EditCoffeeReviewForm.tsx`
Expected: exactly one line per file — the request-payload entry.

Run: `grep -c 'label="קפה"\|label="אוכל"\|label="אווירה"\|label="מחיר"' src/components/AddCoffeeReviewForm.tsx src/components/EditCoffeeReviewForm.tsx`
Expected: `0` for both files — the four literal `<ScaleBar label="…">` blocks have been replaced by the registry map, which passes `label={c.label}`.

- [ ] **Step 6: Manual check against the dev server**

Run: `npm run dev`

Then in the browser at `/mekafkefim` (sign in as an owner, or as a user holding `mekafkefim:write`):

1. Edit any review. Tick `אוכל` in the new pill row → the `אוכל` slider disappears from **both** the תום and תומר tabs.
2. Save. The card's second ring is now a dashed grey ring captioned `אין / אוכל`, and the headline score has risen to the mean of the remaining three.
3. Edit again and un-tick `אוכל` → the previous food rating is still there, not zeroed.
4. Tick all four → the form shows `כל הקטגוריות מושבתות במקום הזה`; the saved card reads `לא דורג` and sorts to the bottom.

`CLAUDE.md` notes that local Mongo credentials on this machine are stale, so `next build` logs `bad auth` while still passing. If step 1 can't load data at all, stop and report rather than working around it — the remaining checks need live documents.

- [ ] **Step 7: Commit**

```bash
git add src/components/AddCoffeeReviewForm.tsx src/components/EditCoffeeReviewForm.tsx
git commit -m "feat(mekafkefim): place-level pills to disable a rating category"
```

---

### Task 5: Full verification sweep + record the invariants in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (the `### Coffee reviews (/mekafkefim)` section under "Feature-specific notes")

**Interfaces:**
- Consumes: everything above.
- Produces: nothing consumed by code.

- [ ] **Step 1: Document the invariants**

Append to the `### Coffee reviews (`/mekafkefim`)` section in `CLAUDE.md`, after the existing base64-photos bullet:

```markdown
- **Scoring has one source of truth**: `scoreReview()` in `src/types/coffee.ts`,
  used by the API sort, the list page and the card. It replaced three
  implementations that disagreed (two `nonZeroAvg` copies plus a naive `/4`
  API sort that counted zeros). Don't add a fourth.
- Two distinct blank states, and the card renders them differently: a rating
  of `0` means *not rated yet* (`—`), while a category listed in the place's
  `disabledCategories` means *not measured here* (`אין`) — the café has no
  kitchen. Both are excluded from the averages.
- Disabling a category **never clears the stored ratings** — they're ignored,
  so un-ticking restores the old score. Don't "tidy up" by zeroing them.
- `COFFEE_CATEGORIES` in `src/types/coffee.ts` is the registry both forms and
  the card map over. A new category is one entry there plus two fields on
  `CoffeeReviewRatings` — not four more hand-written slider blocks.
- `src/types/coffee.ts` must stay **import-free**:
  `src/lib/__tests__/coffee-score.test.ts` imports it via a relative `.ts`
  path for `node --test`, which can't resolve the `@/…` alias.
- `ScaleBar` is `min="1"` on purpose (`src/components/RatingStars.tsx`). A
  rating can't be un-set by dragging; per-place disabling is the intended way
  to take a category out of the score.
```

- [ ] **Step 2: Run the full verification set**

Run: `npx tsc --noEmit --incremental false --pretty false`
Expected: no output.

Run: `npm run lint`
Expected: no errors.

Run: `npm test`
Expected: all suites pass, including the nine `coffee-score` tests.

Run: `npm run build`
Expected: succeeds. Per `CLAUDE.md` it will log `bad auth` roughly ten times on this machine (stale local Mongo credentials) and still pass — that is expected, not a failure. If it dies with `Cannot find module for page: /_document`, `rm -rf .next` and retry.

- [ ] **Step 3: Confirm the working tree holds only intended changes**

Run: `git status -s --untracked-files=all`
Expected: only `CLAUDE.md` modified, plus the pre-existing untracked `scripts/backfill-bodyweight.mjs`, which is unrelated to this work — **leave it untracked and uncommitted.**

Run: `git log --oneline origin/main..HEAD`
Expected: the spec commit plus the four feature commits from Tasks 1-4.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record mekafkefim scoring invariants"
```

- [ ] **Step 5: Ship**

Do not push directly. Hand off to the project's blessed path, which runs verify → commit → `/code-review` against `origin/main` → apply findings → fast-forward push:

```
/ship
```

Live data can't be verified from this machine, so after the Vercel deploy finishes, confirm on `https://www.hatom.im/mekafkefim` that a place with a disabled category shows the `אין` ring and ranks on the remaining categories.

---

## Self-Review

**Spec coverage** — every section of `2026-09-09-coffee-category-disable-design.md` maps to a task:

| Spec section | Task |
|---|---|
| Category registry (`COFFEE_CATEGORIES`, `CoffeeReviewRatings`, `CoffeeCategoryDef`) | 1 |
| `disabledCategories` on `CoffeeReview` + DTO | 1 |
| `resolveDisabledCategories` contract (missing → `[]`, unknown → `null`) | 1 (impl + tests) |
| `scoreReview` and all five scoring rules | 1 |
| Storage / no migration | 1 (types), asserted by the legacy-document test |
| "Disabling never destroys ratings" | 1 (test), 4 (comment + manual step 3) |
| `POST` validation | 2 |
| `GET` sort replacement | 2 |
| `PATCH` key-presence validation | 2 |
| Place-level pill row, `מה לא נמדד במקום הזה?` | 4 |
| Registry-driven sliders, ~50 lines removed per form | 4 |
| All-four-disabled allowed, no validation error | 1 (test), 4 (empty-state copy) |
| `ScoreRing` disabled state, two-line caption, stable grid | 3 |
| Card rings from `ReviewScores.categories` | 3 |
| Page sort + footer note | 3 |
| Non-goals (`min="1"`, no per-reviewer N/A, no new categories) | 5 (recorded in `CLAUDE.md`) |
| Test list (all eight bullets) | 1 |
| Verification commands | 5 |

**Placeholder scan:** no TBD/TODO; every code step carries the actual code; no "similar to Task N" back-references — Task 4 repeats the full `renderRatingForm` body rather than pointing at its twin.

**Type consistency:** `scoreReview` / `resolveDisabledCategories` / `COFFEE_CATEGORIES` / `CoffeeCategory` / `ScorableReview` / `ReviewScores` / `CategoryScore` are spelled identically in Tasks 1-4. `ScoreRing`'s prop is `disabled` in both its definition and its call site. `scores.categories[].label` feeds `ScoreRing`'s `label`, and `ratings`/`setters` are keyed by `CoffeeCategory`, matching `COFFEE_CATEGORIES[].id`.

**One deviation from the spec, deliberate:** the spec said the card's caption "becomes two lines". Task 3 implements that but adds `minHeight: '26px'` to the caption wrapper, so a disabled column doesn't grow taller than its three neighbours. This is what makes the spec's own "the 4-ring grid stays stable" promise actually hold.
