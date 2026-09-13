# Mekafkefim v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/mekafkefim` into a browsable coffee guide — split food/pastry, add coffee price + tried-items + per-reviewer notes + tags + area + opening hours, and a sort/filter/stats discovery UI — then enrich the existing places with photos/links/coords/hours.

**Architecture:** All pure, testable logic (scoring, tiers, gap, open-now, sort, filter, stats, control (de)serialization, field resolvers) lives in the import-free `src/types/coffee.ts` and is TDD'd via `node --test`. The API routes call the resolvers for validation. The card and the two forms (via a new shared `CoffeeReviewFormFields`) render the new fields; the page hosts the controls bar + stats header and syncs state to the URL and localStorage. Enrichment is a one-off fill-empty-only Node script.

**Tech Stack:** Next.js 15 (App Router), TypeScript, React client components, MongoDB driver, `node:test` (no extra deps).

**Spec:** `docs/superpowers/specs/2026-09-13-mekafkefim-v2-design.md`

## Global Constraints

- `src/types/coffee.ts` **must stay import-free** — no `import`/`require`, no `@/…` aliases. `src/lib/__tests__/coffee-score.test.ts` loads it via the relative path `../../types/coffee.ts` under `node --test`, which cannot resolve aliases.
- Ratings are `0`–`10` in `0.5` steps. `0` = "not rated" (excluded from averages). A category in `disabledCategories` = "not measured here" (also excluded). **Never zero out stored ratings** to "disable" — disabling is separate.
- Scoring stays **equal-weight**. Do not add weighting.
- Category **ids are English and stable**; `price`'s id stays `price` (only its label changes to `שווי`). No document migration.
- Category display order in `COFFEE_CATEGORIES`: `coffee, food, pastry, atmosphere, price`.
- Copy/UI is **Hebrew + RTL**; ids stay English.
- Every mutation stays gated on `mekafkefim:write` (existing `requireFeatureCaller`).
- Verify before every commit: `npx tsc --noEmit --incremental false --pretty false` && `npm run lint` && `npm test`. The Husky pre-commit hook additionally runs `npm test` + `next build`; the recurring `bad auth` Mongo lines during build are known-harmless (stale local creds) and do not fail the build. If the Next cache wedges (`Cannot find module for page: /_document`), `rm -rf .next` and retry.
- Preset **tags** (`COFFEE_TAGS`, id/label/emoji): `work` 💻 ידידותי לעבודה · `outdoor` 🌳 ישיבה בחוץ · `dogs` 🐕 ידידותי לכלבים · `brunch` 🥑 בראנץ׳ · `vegan` 🌱 אופציות טבעוניות · `takeaway` 🥡 טייק-אווי · `quiet` 🤫 שקט/רגוע · `groups` 👥 מתאים לקבוצות · `ac` ❄️ מיזוג · `bitter` 😖 קפה מר.
- Preset **areas** (`COFFEE_AREAS`): `פלורנטין`, `נווה צדק`, `לב העיר/מרכז`, `הצפון הישן`, `הצפון החדש`, `כרם התימנים`, `רוטשילד`, `שפירא`, `באזל`, `יפו`, `אחר`.
- **Price tier thresholds** (₪ of a coffee): `undefined`/`≤0` → `0` (unknown); `≤15` → `1` (₪); `≤20` → `2` (₪₪); `>20` → `3` (₪₪₪).
- **Controversy threshold:** `reviewerGap ≥ 2.0` (and both reviewers must have rated).
- **Opening hours:** `OpeningHours` is a 7-element array, index `0`=Sunday … `6`=Saturday. Each entry is `null` (closed that day) or `{ open: "HH:MM", close: "HH:MM" }` (24h, zero-padded, `close > open`, no past-midnight). "Open now" is computed in `Asia/Jerusalem`.

---

## Phase 1 — Model, helpers, API validation (all TDD in `coffee.ts`)

### Task 1: Add the `pastry` category, relabel `price`, add pastry rating fields

**Files:**
- Modify: `src/types/coffee.ts` (the `CoffeeCategory` type ~line 10, `CoffeeReviewRatings` ~14, `COFFEE_CATEGORIES` ~34)
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Produces: `CoffeeCategory = 'coffee'|'food'|'pastry'|'atmosphere'|'price'`; `CoffeeReviewRatings` gains `tomPastryRating: number; tomerPastryRating: number`; `COFFEE_CATEGORIES` has 5 entries in the order above, `price` label `'שווי'`, `pastry` label `'מאפים'`.

- [ ] **Step 1: Update the registry-order test to expect five categories**

In `coffee-score.test.ts`, change the existing assertion:

```ts
test('the registry is the five categories in display order', () => {
  assert.deepEqual(
    COFFEE_CATEGORIES.map((c) => c.id),
    ['coffee', 'food', 'pastry', 'atmosphere', 'price'],
  );
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test 2>&1 | grep -A3 "registry is the five"`
Expected: FAIL (registry still has 4 entries / no `pastry`).

- [ ] **Step 3: Implement the registry + fields**

In `coffee.ts`:

```ts
export type CoffeeCategory =
  | 'coffee' | 'food' | 'pastry' | 'atmosphere' | 'price';
```

Add to `CoffeeReviewRatings` (keep the existing 8; add these 2):

```ts
  tomPastryRating: number;
  tomerPastryRating: number;
```

Rewrite `COFFEE_CATEGORIES`:

```ts
export const COFFEE_CATEGORIES: readonly CoffeeCategoryDef[] = [
  { id: 'coffee',     label: 'קפה',    tomField: 'tomCoffeeRating',     tomerField: 'tomerCoffeeRating'     },
  { id: 'food',       label: 'אוכל',   tomField: 'tomFoodRating',       tomerField: 'tomerFoodRating'       },
  { id: 'pastry',     label: 'מאפים',  tomField: 'tomPastryRating',     tomerField: 'tomerPastryRating'     },
  { id: 'atmosphere', label: 'אווירה', tomField: 'tomAtmosphereRating', tomerField: 'tomerAtmosphereRating' },
  { id: 'price',      label: 'שווי',   tomField: 'tomPriceRating',      tomerField: 'tomerPriceRating'      },
];
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: all pass (existing scoring tests still green — `scoreReview` iterates the registry, so pastry rides along; a review with no pastry rating reads `?? 0` = unrated and is excluded, so existing numbers are unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): add pastry category, relabel price -> שווי"
```

---

### Task 2: Prove scoring handles pastry (regression + participation)

**Files:**
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Consumes: `scoreReview`, `COFFEE_CATEGORIES` from Task 1.

- [ ] **Step 1: Add tests**

```ts
test('a review with no pastry rating scores exactly as before (pastry unrated)', () => {
  // RATED has no pastry fields → pastry is 0 = unrated = excluded.
  const s = scoreReview(RATED);
  assert.equal(byId(s, 'pastry').tom, 0);
  assert.equal(byId(s, 'pastry').combined, 0);
  // Tom's overall is still the mean of his 4 rated categories (8,4,7,9) = 7.0
  assert.equal(s.tom, 7);
});

test('a rated pastry participates in the average', () => {
  const s = scoreReview({ ...RATED, tomPastryRating: 10, tomerPastryRating: 10 });
  // Tom now averages 8,4,10,7,9 = 7.6
  assert.equal(Number(s.tom.toFixed(2)), 7.6);
  assert.equal(byId(s, 'pastry').combined, 10);
});

test('disabling pastry excludes it even when rated', () => {
  const s = scoreReview({
    ...RATED, tomPastryRating: 1, tomerPastryRating: 1,
    disabledCategories: ['pastry'],
  });
  assert.equal(byId(s, 'pastry').disabled, true);
  assert.equal(s.tom, 7); // back to the 4-category average
});
```

- [ ] **Step 2: Run tests, verify pass**

Run: `npm test 2>&1 | grep -E "pastry|tests|pass|fail"`
Expected: all pass (no implementation needed — this locks Task 1's behavior).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/coffee-score.test.ts
git commit -m "test(mekafkefim): scoring covers pastry participation + exclusion"
```

---

### Task 3: Extend `CoffeeReview`/DTO with the new place-level fields and value types

**Files:**
- Modify: `src/types/coffee.ts` (`CoffeeReview` ~41, `CreateCoffeeReviewDto` ~55; add new types near the top)

**Interfaces:**
- Produces:
  ```ts
  export interface TriedItem { name: string; priceIls?: number }
  export type DayHours = { open: string; close: string } | null;
  export type OpeningHours = DayHours[]; // length 7, index 0 = Sunday
  ```
  and these optional fields on both `CoffeeReview` and `CreateCoffeeReviewDto`:
  `coffeePriceIls?: number; coffeeDrinkLabel?: string; triedItems?: TriedItem[]; tomNotes?: string; tomerNotes?: string; tags?: string[]; area?: string; lat?: number; lng?: number; openingHours?: OpeningHours`.

- [ ] **Step 1: Add the types + fields**

Add near the other interfaces in `coffee.ts`:

```ts
export interface TriedItem {
  name: string;
  priceIls?: number;
}

// Index 0 = Sunday … 6 = Saturday. null = closed that day.
export type DayHours = { open: string; close: string } | null;
export type OpeningHours = DayHours[];
```

Add these optional fields to **both** `CoffeeReview` and `CreateCoffeeReviewDto` (they already share `CoffeeReviewRatings`, `disabledCategories`, `photoUrl`, `mapsUrl`, `instagramUrl`):

```ts
  coffeePriceIls?: number;
  coffeeDrinkLabel?: string;
  triedItems?: TriedItem[];
  tomNotes?: string;
  tomerNotes?: string;
  tags?: string[];
  area?: string;
  lat?: number;
  lng?: number;
  openingHours?: OpeningHours;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit --incremental false --pretty false 2>&1 | head`
Expected: no errors (all fields optional; `CoffeeReviewDocument extends Omit<CoffeeReview,'id'>` picks them up automatically, and `createCoffeeReview` spreads `data`, so the model persists them with no change).

- [ ] **Step 3: Commit**

```bash
git add src/types/coffee.ts
git commit -m "feat(mekafkefim): add place-level fields (price, items, notes, tags, area, hours, coords)"
```

---

### Task 4: `COFFEE_TAGS` registry + `resolveTags`

**Files:**
- Modify: `src/types/coffee.ts`
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Produces: `export interface CoffeeTagDef { id: string; label: string; emoji: string }`; `export const COFFEE_TAGS: readonly CoffeeTagDef[]`; `export function resolveTags(v: unknown): string[] | null` — `undefined`/`null` → `[]`; array of known ids → de-duped ids; anything else (non-array, unknown id, non-string) → `null`.

- [ ] **Step 1: Write failing tests**

```ts
test('resolveTags defaults, de-dupes, and rejects', () => {
  assert.deepEqual(resolveTags(undefined), []);
  assert.deepEqual(resolveTags(null), []);
  assert.deepEqual(resolveTags(['work', 'work', 'vegan']), ['work', 'vegan']);
  assert.equal(resolveTags(['nope']), null);
  assert.equal(resolveTags('work'), null);
  assert.equal(resolveTags([1]), null);
});

test('every tag has an id, label and emoji', () => {
  for (const t of COFFEE_TAGS) {
    assert.ok(t.id && t.label && t.emoji);
  }
  assert.ok(COFFEE_TAGS.some((t) => t.id === 'bitter'));
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test 2>&1 | grep -E "resolveTags|every tag"`
Expected: FAIL (`resolveTags`/`COFFEE_TAGS` not defined).

- [ ] **Step 3: Implement**

```ts
export interface CoffeeTagDef { id: string; label: string; emoji: string }

export const COFFEE_TAGS: readonly CoffeeTagDef[] = [
  { id: 'work',     label: 'ידידותי לעבודה',   emoji: '💻' },
  { id: 'outdoor',  label: 'ישיבה בחוץ',        emoji: '🌳' },
  { id: 'dogs',     label: 'ידידותי לכלבים',    emoji: '🐕' },
  { id: 'brunch',   label: 'בראנץ׳',            emoji: '🥑' },
  { id: 'vegan',    label: 'אופציות טבעוניות',  emoji: '🌱' },
  { id: 'takeaway', label: 'טייק-אווי',         emoji: '🥡' },
  { id: 'quiet',    label: 'שקט/רגוע',          emoji: '🤫' },
  { id: 'groups',   label: 'מתאים לקבוצות',     emoji: '👥' },
  { id: 'ac',       label: 'מיזוג',             emoji: '❄️' },
  { id: 'bitter',   label: 'קפה מר',            emoji: '😖' },
];

const TAG_IDS = new Set<string>(COFFEE_TAGS.map((t) => t.id));

export function resolveTags(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string' || !TAG_IDS.has(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): COFFEE_TAGS registry + resolveTags"
```

---

### Task 5: `COFFEE_AREAS` + `isValidArea`

**Files:**
- Modify: `src/types/coffee.ts`
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Produces: `export const COFFEE_AREAS: readonly string[]`; `export function isValidArea(v: unknown): boolean` — true only for a string in `COFFEE_AREAS`.

- [ ] **Step 1: Write failing test**

```ts
test('isValidArea accepts known areas only', () => {
  assert.equal(isValidArea('פלורנטין'), true);
  assert.equal(isValidArea('אחר'), true);
  assert.equal(isValidArea('Paris'), false);
  assert.equal(isValidArea(3), false);
  assert.equal(COFFEE_AREAS.length, 11);
});
```

- [ ] **Step 2: Run, verify fail** — `npm test 2>&1 | grep isValidArea`

- [ ] **Step 3: Implement**

```ts
export const COFFEE_AREAS: readonly string[] = [
  'פלורנטין', 'נווה צדק', 'לב העיר/מרכז', 'הצפון הישן', 'הצפון החדש',
  'כרם התימנים', 'רוטשילד', 'שפירא', 'באזל', 'יפו', 'אחר',
];

const AREA_SET = new Set<string>(COFFEE_AREAS);
export function isValidArea(v: unknown): boolean {
  return typeof v === 'string' && AREA_SET.has(v);
}
```

- [ ] **Step 4: Run, verify pass** — `npm test 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): COFFEE_AREAS + isValidArea"
```

---

### Task 6: `priceTier`

**Files:**
- Modify: `src/types/coffee.ts`
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Produces: `export function priceTier(ils?: number): 0 | 1 | 2 | 3`.

- [ ] **Step 1: Write failing test**

```ts
test('priceTier buckets coffee prices', () => {
  assert.equal(priceTier(undefined), 0);
  assert.equal(priceTier(0), 0);
  assert.equal(priceTier(13), 1);
  assert.equal(priceTier(15), 1);
  assert.equal(priceTier(18), 2);
  assert.equal(priceTier(20), 2);
  assert.equal(priceTier(24), 3);
});
```

- [ ] **Step 2: Run, verify fail** — `npm test 2>&1 | grep priceTier`

- [ ] **Step 3: Implement**

```ts
// ₪ thresholds for a standard coffee, tuned to Tel Aviv. Tweak here only.
export function priceTier(ils?: number): 0 | 1 | 2 | 3 {
  if (ils === undefined || ils === null || !(ils > 0)) return 0;
  if (ils <= 15) return 1;
  if (ils <= 20) return 2;
  return 3;
}
```

- [ ] **Step 4: Run, verify pass** — `npm test 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): priceTier helper"
```

---

### Task 7: `reviewerGap`

**Files:**
- Modify: `src/types/coffee.ts`
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Produces: `export function reviewerGap(review: ScorableReview): number` — `|tomOverall − tomerOverall|`, but `0` when either reviewer has no overall (unrated), so an un-reviewed place is never "controversial".

- [ ] **Step 1: Write failing test**

```ts
test('reviewerGap is the absolute overall difference, 0 when one side is unrated', () => {
  // RATED: tom overall 7.0, tomer overall 6.5 → gap 0.5
  assert.equal(Number(reviewerGap(RATED).toFixed(2)), 0.5);
  // only Tom rated → gap 0 (not controversial)
  assert.equal(reviewerGap({ tomCoffeeRating: 9 }), 0);
  // empty → 0
  assert.equal(reviewerGap({}), 0);
});
```

- [ ] **Step 2: Run, verify fail** — `npm test 2>&1 | grep reviewerGap`

- [ ] **Step 3: Implement**

```ts
export function reviewerGap(review: ScorableReview): number {
  const s = scoreReview(review);
  if (s.tom <= 0 || s.tomer <= 0) return 0;
  return Math.abs(s.tom - s.tomer);
}
```

- [ ] **Step 4: Run, verify pass** — `npm test 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): reviewerGap for the controversy badge"
```

---

### Task 8: `isOpenNow`

**Files:**
- Modify: `src/types/coffee.ts`
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Produces: `export function isOpenNow(hours: OpeningHours | undefined, at?: Date): boolean` — false when `hours` is absent/malformed; otherwise true iff the `Asia/Jerusalem` weekday's entry is non-null and `open ≤ now < close`.

- [ ] **Step 1: Write failing tests (fixed instants)**

```ts
// A weekly schedule: closed Sunday(0), open 08:00-17:00 the rest.
const HOURS = [
  null,
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '09:00', close: '14:00' },
];

test('isOpenNow respects the Jerusalem weekday + time', () => {
  // 2026-09-14 is a Monday. 12:00 Jerusalem (09:00Z in Sep, IDT = UTC+3).
  assert.equal(isOpenNow(HOURS, new Date('2026-09-14T09:00:00Z')), true);
  // Monday 18:00 Jerusalem (15:00Z) → closed
  assert.equal(isOpenNow(HOURS, new Date('2026-09-14T15:00:00Z')), false);
  // 2026-09-13 is a Sunday → closed all day
  assert.equal(isOpenNow(HOURS, new Date('2026-09-13T09:00:00Z')), false);
  // no data → false
  assert.equal(isOpenNow(undefined, new Date('2026-09-14T09:00:00Z')), false);
});
```

- [ ] **Step 2: Run, verify fail** — `npm test 2>&1 | grep isOpenNow`

- [ ] **Step 3: Implement (uses global `Intl`, no import — stays import-free)**

```ts
export function isOpenNow(hours: OpeningHours | undefined, at: Date = new Date()): boolean {
  if (!Array.isArray(hours) || hours.length !== 7) return false;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const wk = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wk);
  if (dayIndex < 0) return false;
  const entry = hours[dayIndex];
  if (!entry) return false;
  const now = `${hh}:${mm}`;
  return entry.open <= now && now < entry.close; // zero-padded HH:MM compares lexically
}
```

Note: `Intl` may render the hour as `"24"` at midnight in some engines — guard is unnecessary for café hours, but if a test flakes, normalize `hh === '24' ? '00' : hh`.

- [ ] **Step 4: Run, verify pass** — `npm test 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): isOpenNow (Asia/Jerusalem, testable)"
```

---

### Task 9: `resolveTriedItems` + `resolveOpeningHours` validators

**Files:**
- Modify: `src/types/coffee.ts`
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Produces:
  - `resolveTriedItems(v: unknown): TriedItem[] | null` — `undefined`/`null` → `[]`; array (≤20) of `{ name: 1–60 chars, priceIls?: number ≥ 0 }` → normalized (name trimmed, empty names dropped); anything else → `null`.
  - `resolveOpeningHours(v: unknown): OpeningHours | null` — array of exactly 7 entries, each `null` or `{ open, close }` matching `^\d{2}:\d{2}$` with `close > open` → normalized; anything else → `null`. (Absence is handled by the caller not calling it.)

- [ ] **Step 1: Write failing tests**

```ts
test('resolveTriedItems normalizes and rejects', () => {
  assert.deepEqual(resolveTriedItems(undefined), []);
  assert.deepEqual(
    resolveTriedItems([{ name: '  שקשוקה ', priceIls: 52 }, { name: 'x' }]),
    [{ name: 'שקשוקה', priceIls: 52 }, { name: 'x' }],
  );
  assert.deepEqual(resolveTriedItems([{ name: '   ' }]), []); // empty names dropped
  assert.equal(resolveTriedItems([{ name: 'x', priceIls: -1 }]), null);
  assert.equal(resolveTriedItems('nope'), null);
});

test('resolveOpeningHours validates a 7-day grid', () => {
  const ok = [null, { open: '08:00', close: '17:00' }, null, null, null, null, null];
  assert.deepEqual(resolveOpeningHours(ok), ok);
  assert.equal(resolveOpeningHours([null]), null);            // wrong length
  assert.equal(
    resolveOpeningHours([{ open: '9:00', close: '17:00' }, null, null, null, null, null, null]),
    null,                                                      // not zero-padded
  );
  assert.equal(
    resolveOpeningHours([{ open: '18:00', close: '09:00' }, null, null, null, null, null, null]),
    null,                                                      // close <= open
  );
});
```

- [ ] **Step 2: Run, verify fail** — `npm test 2>&1 | grep -E "resolveTriedItems|resolveOpeningHours"`

- [ ] **Step 3: Implement**

```ts
export function resolveTriedItems(v: unknown): TriedItem[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 20) return null;
  const out: TriedItem[] = [];
  for (const raw of v) {
    if (typeof raw !== 'object' || raw === null) return null;
    const name = typeof (raw as any).name === 'string' ? (raw as any).name.trim() : null;
    if (name === null || name.length > 60) return null;
    if (name === '') continue; // drop blank rows
    const price = (raw as any).priceIls;
    if (price !== undefined) {
      if (typeof price !== 'number' || !(price >= 0)) return null;
      out.push({ name, priceIls: price });
    } else {
      out.push({ name });
    }
  }
  return out;
}

const HHMM = /^\d{2}:\d{2}$/;
export function resolveOpeningHours(v: unknown): OpeningHours | null {
  if (!Array.isArray(v) || v.length !== 7) return null;
  const out: OpeningHours = [];
  for (const entry of v) {
    if (entry === null) { out.push(null); continue; }
    if (typeof entry !== 'object') return null;
    const { open, close } = entry as any;
    if (typeof open !== 'string' || typeof close !== 'string') return null;
    if (!HHMM.test(open) || !HHMM.test(close) || !(close > open)) return null;
    out.push({ open, close });
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass** — `npm test 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): resolveTriedItems + resolveOpeningHours validators"
```

---

### Task 10: Validate the new fields in the API (POST + PATCH)

**Files:**
- Modify: `src/app/api/coffee-reviews/route.ts` (POST, after the existing rating validation ~line 91)
- Modify: `src/app/api/coffee-reviews/[id]/route.ts` (PATCH, alongside the existing `disabledCategories` block ~line 77)

**Interfaces:**
- Consumes: `resolveTags`, `isValidArea`, `resolveTriedItems`, `resolveOpeningHours`, `priceTier` (unused here), from Tasks 4–9.
- Produces: POST/PATCH reject bad new-field payloads with `400`; good ones persist.

**Note on pastry ratings:** the existing rating-range validation reads fixed field names. Extend both arrays to include `tomPastryRating`/`tomerPastryRating` so pastry is range-checked like the rest.

- [ ] **Step 1: Extend rating arrays + add new-field validation in POST**

In `route.ts`, add `data.tomPastryRating` and `data.tomerPastryRating` to the `tomRatings`/`tomerRatings` arrays (POST also requires them present — but to stay backward-compatible with old clients during rollout, treat missing pastry as `0`: `data.tomPastryRating ?? 0`). Then, after `disabledCategories` is resolved, add:

```ts
// --- new place-level fields ---
if (data.tags !== undefined) {
  const tags = resolveTags(data.tags);
  if (tags === null) return NextResponse.json({ error: 'Invalid tags' }, { status: 400 });
  data.tags = tags;
}
if (data.area !== undefined && data.area !== null && !isValidArea(data.area)) {
  return NextResponse.json({ error: 'Invalid area' }, { status: 400 });
}
if (data.triedItems !== undefined) {
  const items = resolveTriedItems(data.triedItems);
  if (items === null) return NextResponse.json({ error: 'Invalid triedItems' }, { status: 400 });
  data.triedItems = items;
}
if (data.openingHours !== undefined && data.openingHours !== null) {
  const hours = resolveOpeningHours(data.openingHours);
  if (hours === null) return NextResponse.json({ error: 'Invalid openingHours' }, { status: 400 });
  data.openingHours = hours;
}
for (const [key, max] of [['coffeeDrinkLabel', 40], ['tomNotes', 500], ['tomerNotes', 500]] as const) {
  if (data[key] !== undefined && data[key] !== null && (typeof data[key] !== 'string' || data[key].length > max)) {
    return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
  }
}
if (data.coffeePriceIls !== undefined && data.coffeePriceIls !== null &&
    (typeof data.coffeePriceIls !== 'number' || !(data.coffeePriceIls >= 0))) {
  return NextResponse.json({ error: 'Invalid coffeePriceIls' }, { status: 400 });
}
for (const key of ['lat', 'lng'] as const) {
  if (data[key] !== undefined && data[key] !== null && typeof data[key] !== 'number') {
    return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
  }
}
```

Import the helpers at the top: `import { CreateCoffeeReviewDto, resolveDisabledCategories, resolveTags, isValidArea, resolveTriedItems, resolveOpeningHours, scoreReview } from '@/types/coffee';`

- [ ] **Step 2: Mirror the same block in PATCH**

In `[id]/route.ts`, add `tomPastryRating`/`tomerPastryRating` to the range-check arrays, and paste the same "new place-level fields" block (it already uses the `if (X !== undefined)` shape that PATCH needs so it only touches sent fields). Add the same import line.

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc --noEmit --incremental false --pretty false 2>&1 | head && npm run lint 2>&1 | tail -5`
Expected: clean. (`data` is typed loosely in PATCH already; in POST cast as needed — `data` is `CreateCoffeeReviewDto`, all new fields optional, so assignments type-check.)

- [ ] **Step 4: Manual smoke via the running app (optional but recommended)**

Run `npm run dev`, sign in as an owner, POST a review with `tags: ['work']`, `area: 'פלורנטין'`, `coffeePriceIls: 16`, a `triedItems` row, and an `openingHours` grid; confirm `201` and the doc persists. Then try `tags: ['bogus']` → expect `400`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/coffee-reviews/route.ts src/app/api/coffee-reviews/[id]/route.ts
git commit -m "feat(mekafkefim): validate + persist new review fields in the API"
```

---

## Phase 2 — Forms & card

### Task 11: Extract the shared `CoffeeReviewFormFields` (pure refactor, no new fields yet)

**Files:**
- Create: `src/components/CoffeeReviewFormFields.tsx`
- Create: `src/lib/useCoffeeReviewForm.ts` (a hook holding all form state + the request body builder)
- Modify: `src/components/AddCoffeeReviewForm.tsx`, `src/components/EditCoffeeReviewForm.tsx`

**Interfaces:**
- Produces:
  - `useCoffeeReviewForm(initial?: Partial<CoffeeReview>)` → `{ state, setters, disabledCategories, toggleCategory, buildBody(): CreateCoffeeReviewDto, reset() }` where `state` holds every editable field and `buildBody()` returns exactly today's POST body (place name, 8 ratings, disabledCategories, photo/maps/instagram — new fields added in Task 12).
  - `<CoffeeReviewFormFields form={useCoffeeReviewForm(...)} />` — renders the place fields + the disable pills + the תום/תומר reviewer tabs with `ScaleBar` per active category (moved verbatim from the current forms).
- Consumes: `COFFEE_CATEGORIES`, `RatingStars`, `ScaleBar`.

- [ ] **Step 1: Build the hook** — move all `useState` + `toggleCategory` + the reset logic out of `AddCoffeeReviewForm` into `useCoffeeReviewForm`, seeded from `initial` (Edit passes the review; Add passes nothing → zeros/empties). Include `buildBody()` returning the current POST body shape.

- [ ] **Step 2: Build `CoffeeReviewFormFields`** — move the JSX for place name, maps/instagram/photo inputs, the disable pills, the reviewer tabs, and `renderRatingForm` into the new component, driven by `form`.

- [ ] **Step 3: Rewire both forms** — `AddCoffeeReviewForm` and `EditCoffeeReviewForm` become thin: instantiate the hook, render `<CoffeeReviewFormFields form={form} />`, keep their own submit button + POST/PATCH fetch + error handling (Add resets on success, Edit calls `onSuccess`).

- [ ] **Step 4: Verify no behavior change**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint && npm run build 2>&1 | tail -5`
Then `npm run dev`: open `/mekafkefim` as owner, add a review and edit one — confirm identical behavior to before.

- [ ] **Step 5: Commit**

```bash
git add src/components/CoffeeReviewFormFields.tsx src/lib/useCoffeeReviewForm.ts src/components/AddCoffeeReviewForm.tsx src/components/EditCoffeeReviewForm.tsx
git commit -m "refactor(mekafkefim): shared CoffeeReviewFormFields + useCoffeeReviewForm"
```

---

### Task 12: Add the new inputs to the shared fields

**Files:**
- Modify: `src/lib/useCoffeeReviewForm.ts`, `src/components/CoffeeReviewFormFields.tsx`

**Interfaces:**
- Consumes: `COFFEE_TAGS`, `COFFEE_AREAS`, `TriedItem`, `OpeningHours`, `DayHours`.
- Produces: `buildBody()` now also sends `coffeePriceIls`, `coffeeDrinkLabel`, `triedItems`, `tomNotes`, `tomerNotes`, `tags`, `area`, `openingHours` (each `undefined` when empty so the API leaves it alone). Pastry `ScaleBar` appears automatically (it's in `COFFEE_CATEGORIES`).

- [ ] **Step 1: Extend the hook state** — add state + setters for `coffeePriceIls` (number|''), `coffeeDrinkLabel`, `triedItems` (`TriedItem[]` with add/remove), `tomNotes`, `tomerNotes`, `tags` (`string[]` toggle), `area`, `openingHours` (`OpeningHours`, default 7×`null`). Seed all from `initial`. Extend `buildBody()` to include them (convert `''`→`undefined`, empty arrays→`undefined`, all-null hours→`undefined`).

- [ ] **Step 2: Render the new inputs** in `CoffeeReviewFormFields` (place-level, above the reviewer tabs, matching the existing amber styling):
  - Coffee price ₪ number input + drink-label text input (side by side).
  - Tags: chips mapping over `COFFEE_TAGS` (toggle in/out of `tags`), same pill pattern as the disable buttons.
  - Area: a `<select>` over `COFFEE_AREAS` (blank default).
  - Tried-items editor: a list of rows `{name, priceIls}` with an "＋ הוסף פריט" button and a ✕ per row.
  - Opening hours: a **collapsible** section (`<details>`), one row per day (א–ש) with an "סגור" checkbox and two `type="time"` inputs; unchecked = `null`.
  - Notes: two `<textarea>` (Tom, Tomer), `maxLength={500}`, placed inside the matching reviewer tab in `renderRatingForm`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint && npm run build 2>&1 | tail -5`
Then `npm run dev`: add a review filling every new field; confirm it saves and re-opens in Edit with the values intact.

- [ ] **Step 4: Commit**

```bash
git add src/lib/useCoffeeReviewForm.ts src/components/CoffeeReviewFormFields.tsx
git commit -m "feat(mekafkefim): capture price, items, notes, tags, area, hours in the form"
```

---

### Task 13: Render everything new on the card

**Files:**
- Modify: `src/components/CoffeeReviewCard.tsx`

**Interfaces:**
- Consumes: `scoreReview`, `priceTier`, `reviewerGap`, `isOpenNow`, `COFFEE_TAGS`, `COFFEE_CATEGORIES`.
- Produces: `CoffeeReviewCard` accepts a new optional prop `headlineMetric?: SortMetric` (defined in Task 14; until then default the headline to `'coffee'`). The 5th (pastry) ring already renders because the ring list maps over `scores.categories`.

- [ ] **Step 1: Headline** — compute the headline number from `headlineMetric` (default `'coffee'`): coffee/overall/food/pastry/atmosphere/value → the matching `scores.categories[...].combined` or `scores.combined`; show it big with the metric's Hebrew label, and the overall as the small secondary line.

- [ ] **Step 2: Price + tier badge** — when `review.coffeePriceIls`, show `₪{price}` + the `coffeeDrinkLabel`, and a tier badge rendering `'₪'.repeat(priceTier(price))`.

- [ ] **Step 3: Tags chips** — map `review.tags` → `COFFEE_TAGS` entries → `{emoji} {label}` chips (skip unknown ids defensively).

- [ ] **Step 4: Open-now** — when `review.openingHours`, show a badge: `isOpenNow(review.openingHours)` → green `פתוח עכשיו` else grey `סגור`; next to it, when `review.mapsUrl`, a small link `שעות בגוגל ↗` → `mapsUrl` (`target="_blank" rel="noopener noreferrer"`).

- [ ] **Step 5: Controversy badge** — when `reviewerGap(review) >= 2`, show a `🔥 מחלוקת` badge near the rank stamp.

- [ ] **Step 6: Tried-items + notes + area** — render `triedItems` as a small `name … ₪price` list; show `area` in the header line; render `tomNotes`/`tomerNotes` inside the matching תום/תומר tab (whitespace preserved via `whiteSpace: 'pre-wrap'`).

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint && npm run build 2>&1 | tail -5`
Then `npm run dev` and eyeball a card with all fields populated (RTL intact, rings don't reflow).

- [ ] **Step 8: Commit**

```bash
git add src/components/CoffeeReviewCard.tsx
git commit -m "feat(mekafkefim): card shows price, tags, hours, notes, items, controversy"
```

---

## Phase 3 — Discovery UI

### Task 14: Pure `sortReviews` + `filterReviews` (+ the `SortMetric`/`Filters` types)

**Files:**
- Modify: `src/types/coffee.ts`
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SortMetric =
    | 'coffee' | 'overall' | 'food' | 'pastry' | 'atmosphere' | 'value'
    | 'coffeePrice' | 'date' | 'name';
  export type SortPerspective = 'combined' | 'tom' | 'tomer';
  export interface SortSpec { metric: SortMetric; perspective: SortPerspective; dir: 'asc' | 'desc' }
  export interface CoffeeFilters {
    q?: string; areas?: string[]; tags?: string[]; tiers?: (1|2|3)[];
    minCoffee?: number; hasPhoto?: boolean; hideUnrated?: boolean; openNow?: boolean;
  }
  export function sortReviews<T extends CoffeeReview>(reviews: T[], spec: SortSpec, at?: Date): T[];
  export function filterReviews<T extends CoffeeReview>(reviews: T[], f: CoffeeFilters, at?: Date): T[];
  ```
  `sortReviews` is stable, and **blanks/unrated always sink to the bottom** regardless of `dir` (a place with a `0`/absent value for the active metric goes last). `value` maps to the `price` category; `coffeePrice` reads `coffeePriceIls`; `date` reads `createdAt`; `name` uses `localeCompare`. `perspective` selects `.tom`/`.tomer`/`.combined` for score metrics and is ignored for `coffeePrice`/`date`/`name`.

- [ ] **Step 1: Write failing tests**

```ts
const A: CoffeeReview = { id:'a', placeName:'Alfa', createdAt:'2026-01-01T00:00:00Z', updatedAt:'',
  tomCoffeeRating:9, tomFoodRating:0, tomPastryRating:0, tomAtmosphereRating:0, tomPriceRating:0,
  tomerCoffeeRating:9, tomerFoodRating:0, tomerPastryRating:0, tomerAtmosphereRating:0, tomerPriceRating:0,
  coffeePriceIls:18, tags:['work'], area:'פלורנטין', photoUrl:'x' };
const B: CoffeeReview = { id:'b', placeName:'Bravo', createdAt:'2026-02-01T00:00:00Z', updatedAt:'',
  tomCoffeeRating:6, tomFoodRating:0, tomPastryRating:0, tomAtmosphereRating:0, tomPriceRating:0,
  tomerCoffeeRating:6, tomerFoodRating:0, tomerPastryRating:0, tomerAtmosphereRating:0, tomerPriceRating:0,
  coffeePriceIls:14, tags:[], area:'יפו' };
const C: CoffeeReview = { id:'c', placeName:'Charlie', createdAt:'2026-03-01T00:00:00Z', updatedAt:'',
  tomCoffeeRating:0, tomFoodRating:0, tomPastryRating:0, tomAtmosphereRating:0, tomPriceRating:0,
  tomerCoffeeRating:0, tomerFoodRating:0, tomerPastryRating:0, tomerAtmosphereRating:0, tomerPriceRating:0 };

test('sortReviews by coffee desc puts the unrated place last', () => {
  const out = sortReviews([C, B, A], { metric:'coffee', perspective:'combined', dir:'desc' });
  assert.deepEqual(out.map((r) => r.id), ['a', 'b', 'c']);
});
test('sortReviews by coffeePrice asc keeps unknown-price places last', () => {
  const out = sortReviews([A, C, B], { metric:'coffeePrice', perspective:'combined', dir:'asc' });
  assert.deepEqual(out.map((r) => r.id), ['b', 'a', 'c']); // 14, 18, then no-price
});
test('filterReviews stacks predicates', () => {
  assert.deepEqual(filterReviews([A,B,C], { tags:['work'] }).map(r=>r.id), ['a']);
  assert.deepEqual(filterReviews([A,B,C], { areas:['יפו'] }).map(r=>r.id), ['b']);
  assert.deepEqual(filterReviews([A,B,C], { hasPhoto:true }).map(r=>r.id), ['a']);
  assert.deepEqual(filterReviews([A,B,C], { hideUnrated:true }).map(r=>r.id), ['a','b']);
  assert.deepEqual(filterReviews([A,B,C], { minCoffee:7 }).map(r=>r.id), ['a']);
  assert.deepEqual(filterReviews([A,B,C], { q:'brav' }).map(r=>r.id), ['b']);
});
```

- [ ] **Step 2: Run, verify fail** — `npm test 2>&1 | grep -E "sortReviews|filterReviews"`

- [ ] **Step 3: Implement** in `coffee.ts` — a `metricValue(review, metric, perspective)` returning `number | null` (null = blank/unrated), then `sortReviews` compares with blanks forced last, and `filterReviews` ANDs the predicates (`tiers` via `priceTier`, `openNow` via `isOpenNow`, `q` case-insensitive substring on `placeName`, `minCoffee` on combined coffee). Full code:

```ts
function metricValue(r: CoffeeReview, m: SortMetric, p: SortPerspective): number | null {
  if (m === 'coffeePrice') return typeof r.coffeePriceIls === 'number' && r.coffeePriceIls > 0 ? r.coffeePriceIls : null;
  if (m === 'date') return new Date(r.createdAt).getTime();
  if (m === 'name') return null; // handled by caller (string compare)
  const s = scoreReview(r);
  const pick = (v: { tom: number; tomer: number; combined: number }) =>
    p === 'tom' ? v.tom : p === 'tomer' ? v.tomer : v.combined;
  let v: number;
  if (m === 'overall') v = pick(s);
  else {
    const id = (m === 'value' ? 'price' : m) as CoffeeCategory;
    const cat = s.categories.find((c) => c.id === id)!;
    v = pick(cat);
  }
  return v > 0 ? v : null;
}

export function sortReviews<T extends CoffeeReview>(reviews: T[], spec: SortSpec): T[] {
  const { metric, perspective, dir } = spec;
  const sign = dir === 'asc' ? 1 : -1;
  return [...reviews].sort((a, b) => {
    if (metric === 'name') return a.placeName.localeCompare(b.placeName, 'he') * sign;
    const av = metricValue(a, metric, perspective);
    const bv = metricValue(b, metric, perspective);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;   // blanks always last
    if (bv === null) return -1;
    return (av - bv) * sign;
  });
}

export function filterReviews<T extends CoffeeReview>(reviews: T[], f: CoffeeFilters, at: Date = new Date()): T[] {
  const q = f.q?.trim().toLowerCase();
  return reviews.filter((r) => {
    if (q && !r.placeName.toLowerCase().includes(q)) return false;
    if (f.areas?.length && !(r.area && f.areas.includes(r.area))) return false;
    if (f.tags?.length && !f.tags.every((t) => r.tags?.includes(t))) return false;
    if (f.tiers?.length && !f.tiers.includes(priceTier(r.coffeePriceIls) as 1|2|3)) return false;
    if (typeof f.minCoffee === 'number') {
      const c = scoreReview(r).categories.find((x) => x.id === 'coffee')!.combined;
      if (!(c >= f.minCoffee)) return false;
    }
    if (f.hasPhoto && !r.photoUrl) return false;
    if (f.hideUnrated && scoreReview(r).combined <= 0) return false;
    if (f.openNow && !isOpenNow(r.openingHours, at)) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run, verify pass** — `npm test 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): pure sortReviews + filterReviews"
```

---

### Task 15: Pure control (de)serialization + `computeStats`

**Files:**
- Modify: `src/types/coffee.ts`
- Test: `src/lib/__tests__/coffee-score.test.ts`

**Interfaces:**
- Produces:
  - `export interface CoffeeControls { sort: SortSpec; filters: CoffeeFilters }`
  - `export const DEFAULT_CONTROLS: CoffeeControls` — `sort: { metric:'coffee', perspective:'combined', dir:'desc' }`, `filters: {}`.
  - `serializeControls(c: CoffeeControls): string` → a `URLSearchParams` query string (omitting defaults/empties).
  - `parseControls(query: string): CoffeeControls` → merges parsed values over `DEFAULT_CONTROLS`, ignoring unknown/invalid tokens.
  - `computeStats(reviews: CoffeeReview[]): { count: number; kingOfCoffee?: {name,score}; bestValue?: {name,score}; cheapest?: {name,price}; mostControversial?: {name,gap}; avgPrice?: number }`.

- [ ] **Step 1: Write failing tests** (round-trip + stats)

```ts
test('controls round-trip through the URL, dropping defaults', () => {
  assert.equal(serializeControls(DEFAULT_CONTROLS), '');
  const c = { sort:{metric:'coffeePrice',perspective:'combined',dir:'asc'}, filters:{ tags:['work'], q:'x' } } as const;
  const round = parseControls(serializeControls(c));
  assert.equal(round.sort.metric, 'coffeePrice');
  assert.equal(round.sort.dir, 'asc');
  assert.deepEqual(round.filters.tags, ['work']);
  assert.equal(round.filters.q, 'x');
});
test('parseControls ignores garbage and falls back to defaults', () => {
  const c = parseControls('sort=bogus&dir=sideways');
  assert.equal(c.sort.metric, 'coffee');
  assert.equal(c.sort.dir, 'desc');
});
test('computeStats picks the leaders', () => {
  const s = computeStats([A, B, C]); // from Task 14 fixtures
  assert.equal(s.count, 3);
  assert.equal(s.kingOfCoffee?.name, 'Alfa');
  assert.equal(s.cheapest?.name, 'Bravo');
  assert.equal(s.avgPrice, 16); // (18+14)/2, C has no price
});
```

- [ ] **Step 2: Run, verify fail** — `npm test 2>&1 | grep -E "controls|computeStats"`

- [ ] **Step 3: Implement** `DEFAULT_CONTROLS`, `serializeControls` (write keys: `sort`,`persp`,`dir`,`q`,`areas`(comma),`tags`(comma),`tiers`(comma),`minCoffee`,`photo`,`hideUnrated`,`open`; skip defaults/empties), `parseControls` (validate `metric` against the `SortMetric` union, `perspective`/`dir` against their unions, tags/areas kept as-is — the UI only offers valid ones and `filterReviews` is tolerant), and `computeStats` (single pass; `avgPrice` rounds to nearest ₪; `mostControversial` uses `reviewerGap`, ignoring `0`).

- [ ] **Step 4: Run, verify pass** — `npm test 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/types/coffee.ts src/lib/__tests__/coffee-score.test.ts
git commit -m "feat(mekafkefim): control URL (de)serialization + computeStats"
```

---

### Task 16: Wire the discovery UI into the page

**Files:**
- Create: `src/components/CoffeeControlsBar.tsx`, `src/components/CoffeeStatsHeader.tsx`
- Modify: `src/app/mekafkefim/page.tsx`

**Interfaces:**
- Consumes: `CoffeeControls`, `DEFAULT_CONTROLS`, `parseControls`, `serializeControls`, `sortReviews`, `filterReviews`, `computeStats`, `SortMetric`, `COFFEE_TAGS`, `COFFEE_AREAS`; passes `headlineMetric={controls.sort.metric}` into `CoffeeReviewCard`.
- Produces: page derives the displayed list as `sortReviews(filterReviews(reviews, controls.filters), controls.sort)` and keeps `controls` in state.

- [ ] **Step 1: State + persistence** — on mount, initialize `controls` from `window.location.search` via `parseControls`; if the query is empty, fall back to `localStorage.getItem('mekafkefim:controls')` (JSON, wrapped in try/catch — it can throw/deserialize wrong). On every change, `serializeControls` → `router.replace('?' + qs)` (Next `useRouter`) **and** `localStorage.setItem(...)`. URL wins on load.

- [ ] **Step 2: `CoffeeStatsHeader`** — render the six tiles from `computeStats(reviews)` (all places, not the filtered subset): ☕ מלך הקפה, 💰 הכי משתלם, 🪙 הכי זול, 🔥 הכי שנוי במחלוקת, 📊 מחיר ממוצע, 🏙️ סה"כ בתי קפה. Each tile hides gracefully when its datum is missing. Match the paper/receipt aesthetic.

- [ ] **Step 3: `CoffeeControlsBar`** — a search input; a sort `<select>` (metric) + perspective `<select>` (greyed/disabled when metric ∈ `{coffeePrice,date,name}`) + a dir toggle; filter controls for area (multi), tags (multi chips over `COFFEE_TAGS`), price tier (₪/₪₪/₪₪₪ toggles), min-coffee slider, and toggles for has-photo, hide-unrated, פתוח עכשיו. Emits a new `CoffeeControls` up to the page. Collapsible on mobile.

- [ ] **Step 4: Swap the hardcoded sort** — replace the current `sortedReviews` (`page.tsx:63`) with the filtered+sorted derivation; render `CoffeeStatsHeader` + `CoffeeControlsBar` above the grid; pass `headlineMetric`. Keep the empty/loading/error states.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --incremental false --pretty false && npm run lint && npm run build 2>&1 | tail -5`
Then `npm run dev`: change sort/filters and confirm the grid + card headline update, the URL reflects the state, a reload restores it, and pasting the URL in a fresh tab reproduces the view. Check phone width (~400px).

- [ ] **Step 6: Commit**

```bash
git add src/components/CoffeeControlsBar.tsx src/components/CoffeeStatsHeader.tsx src/app/mekafkefim/page.tsx
git commit -m "feat(mekafkefim): sort/filter/search controls + stats header (URL + localStorage)"
```

---

## Phase 4 — Enrichment (data-only)

### Task 17: Fill-empty-only enrichment of the existing places

**Files:**
- Create: `scripts/enrich-coffee-reviews.mjs` (a standalone Node script; not bundled by Next)
- Uses: `.env.workout` (`MONGO_URI`) — already provisioned by the user.

**Interfaces:**
- Consumes: the live `coffeeReviews` collection.
- Produces: each place's empty `photoUrl`/`mapsUrl`/`instagramUrl`/`lat`/`lng`/`area`/`openingHours` filled; nothing else touched.

- [ ] **Step 1: Read the current places** — write `scripts/enrich-coffee-reviews.mjs` that connects with `process.env.MONGO_URI` (loaded from `.env.workout`) and prints every place's `_id`, `placeName`, and which of the six enrichable fields are empty. Run it read-only first:

```bash
set -a; . ./.env.workout; set +a
/opt/homebrew/bin/node scripts/enrich-coffee-reviews.mjs --list
```

- [ ] **Step 2: Research each place** — dispatch a research sub-agent (web search) to resolve, per place with gaps: a working `photoUrl` (verify `200` + `image/*`, prefer stable hosts, **never** an Instagram CDN image URL), the Google Maps place URL, the Instagram **profile** URL, `lat`/`lng`, the best-matching `area` from `COFFEE_AREAS`, and weekly `openingHours` in the 7-slot shape (index 0 = Sunday). Capture results as `scripts/coffee-enrichment.json` (`[{ _id, photoUrl?, mapsUrl?, instagramUrl?, lat?, lng?, area?, openingHours? }]`).

- [ ] **Step 3: Apply fill-empty-only** — extend the script with an `--apply` mode that, for each entry, `$set`s **only** fields that are currently empty on the doc (re-read each doc and skip any field already present/non-empty), and **never** references ratings, notes, `triedItems`, or `tags`. Validate `openingHours`/`area` against the same rules the API uses before writing.

```bash
/opt/homebrew/bin/node scripts/enrich-coffee-reviews.mjs --apply scripts/coffee-enrichment.json
```

- [ ] **Step 4: Verify + clean up** — re-run `--list` to confirm gaps closed; open `/mekafkefim` and confirm photos, area, and the פתוח עכשיו badge render. Then remove the `MONGO_URI` line from `.env.workout` (leave the file otherwise intact).

- [ ] **Step 5: Commit the script (not the data or creds)**

```bash
git add scripts/enrich-coffee-reviews.mjs
git commit -m "chore(mekafkefim): fill-empty-only enrichment script"
```

`scripts/coffee-enrichment.json` is working data — add it to `.gitignore` or delete it; do not commit place data or any credentials.

---

## Out of scope (future plan)

**Phase 5 — Map view.** Deferred per the spec. Coordinates are collected in Task 17, so a later plan can add a grid↔map toggle with `leaflet` + `react-leaflet` (dynamic import, `ssr:false`); tile hosts are already in the CSP.

---

## Self-Review

**Spec coverage:**
- #1 enrichment → Task 17. #2 pastry split → Tasks 1–2 (+ card ring auto, form auto). #3 coffee price + drink label + tried-items → Tasks 3, 10, 12, 13. #4 sort/filter/stats → Tasks 14–16. #5 per-reviewer notes → Tasks 3, 10, 12, 13. #6 tags → Tasks 4,10,12,13; area → Tasks 5,10,12,13,16; open-now → Tasks 8,13,16; controversy → Tasks 7,13,15; price tier badge → Tasks 6,13; value relabel → Task 1; default coffee sort + headline-tracks-sort → Tasks 13–16; URL+localStorage → Tasks 15–16. Shared form → Task 11. Tests → every Phase 1 & 3 task. Map → explicitly deferred.
- No migration (spec Decision 3): confirmed — no task writes pastry/disabled to existing docs; Task 17 is fill-empty-only on non-rating fields.

**Placeholder scan:** none — every code step carries real code; UI tasks name exact files, components, props, and the specific JSX to add.

**Type consistency:** `SortMetric`/`SortPerspective`/`SortSpec`/`CoffeeFilters` are defined in Task 14 and consumed unchanged in 15/16; `headlineMetric` introduced in Task 13 (default `'coffee'`) and supplied in Task 16; `TriedItem`/`OpeningHours`/`DayHours` defined in Task 3 and used consistently in 9/12/13/14; resolver names (`resolveTags`, `isValidArea`, `resolveTriedItems`, `resolveOpeningHours`, `priceTier`, `reviewerGap`, `isOpenNow`) match between definition (Tasks 4–9) and use (Task 10). `value` metric ↔ `price` category mapping is applied identically in `metricValue` and `filterReviews`.
