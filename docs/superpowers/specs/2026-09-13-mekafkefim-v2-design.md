# Mekafkefim v2: Pastry Split, Prices, Sorting/Filtering, Notes & Enrichment — Design

**Date:** 2026-09-13
**Status:** Approved (design)

## Goal

Grow `/mekafkefim` from a static ranked list into a browsable coffee guide.
Six threads, from the user's request:

1. **Enrich new places** with a photo, Google Maps link, Instagram, coordinates,
   area and opening hours — data-only, written straight to Mongo.
2. **Split the `food` category into `food` + `pastry`** — a café can have pastries
   without a kitchen; each is independently disable-able.
3. **Coffee price** (₪) as an optional field, plus what-you-tried-and-paid.
4. **Sorting + filtering** over every metric, with a stats header.
5. **Per-reviewer notes** (Tom / Tomer).
6. Assorted improvements that make the guide genuinely more useful: tags, area,
   an "open now" badge, a controversy badge.

The unifying complaint behind #2/#4 is *"the ranking isn't always correct."* We
resolve that **by sorting, not by re-weighting** (see Decision 1).

## Current state

- `src/types/coffee.ts` is the single source of truth — the `COFFEE_CATEGORIES`
  registry (`coffee/food/atmosphere/price`), the eight rating fields, the
  `disabledCategories` mechanism, and `scoreReview()` (equal-weight mean of the
  active categories). **The file is import-free** so `node --test` can load it
  relatively; it must stay that way.
- `price` today is a **subjective 0–10 "value" rating**, not a ₪ amount.
- Sort is hardcoded to `scoreReview(x).combined` in **two** places —
  `src/app/mekafkefim/page.tsx:63` and the API GET
  (`src/app/api/coffee-reviews/route.ts:18`). No filtering UI exists.
- `AddCoffeeReviewForm.tsx` and `EditCoffeeReviewForm.tsx` are ~90% duplicate
  (~300 lines each).
- Real data lives in Mongo (`coffeeReviews`); the seed JSON is `[]`.
- `next.config.js` already allows any HTTPS image host and the CSP `img-src` is
  `https:`, so pasted/enriched photo URLs render without config changes.

## Decisions

1. **Ranking correctness is a sort concern, not a scoring one.** Scoring stays
   an **equal-weight** mean. The *default sort* becomes **coffee score** (not
   overall), and a sort control lets the viewer re-rank by anything.
   - Rejected weighting coffee ×2: it hard-codes one person's taste into every
     view, and adding `pastry` as an equal 5th category would otherwise *dilute*
     coffee (25% → 20%), making the complaint worse.
2. **`pastry` is a new equal category; `price` is relabeled, not re-keyed.**
   `CoffeeCategory = 'coffee'|'food'|'pastry'|'atmosphere'|'price'`. The `price`
   **id stays `price`** — only its label flips to **`שווי`** (value-for-money) —
   so `disabledCategories`, the rating field names, and every stored document are
   untouched. `pastry` adds `tomPastryRating`/`tomerPastryRating`.
3. **No data migration.** Existing docs have no `pastry` rating, so `scoreReview`
   reads it as `0` = "not rated" and the card shows an unrated `—` ring. Honest,
   self-correcting, non-destructive. Rejected auto-copying `food → pastry`
   (guessing intent corrupts data) and defaulting pastry to disabled (needs a
   backfill and is easy to forget to undo).
4. **Coffee price is a dedicated field, separate from the tried-items list.**
   `coffeePriceIls` (number) + `coffeeDrinkLabel` (string) is *the* headline
   coffee price — it drives the ₪/₪₪/₪₪₪ badge and "sort by coffee price".
   `triedItems: {name, priceIls?}[]` is a separate place-level list of
   everything else tried. Rejected folding coffee price into `triedItems`: "sort
   by coffee price" would then silently drop places where no item was tagged.
5. **Card headline tracks the active sort.** Whatever metric you sort by is the
   big number, with overall shown secondary — so the number always explains the
   card's position. Rejected a fixed "overall" headline (it disagrees with a
   coffee-first ranking and reads as "the ranking is wrong").
6. **Tags & areas are curated preset registries**, not free text — filters are
   only useful if values are consistent. Both are extensible by adding one
   registry line.
7. **Notes are per reviewer, place-menu is shared.** General impressions are
   `tomNotes`/`tomerNotes` (shown in each reviewer's tab). What was ordered +
   prices is the shared, place-level `triedItems[]`.
8. **Opening hours are a stored weekly snapshot; "open now" is computed live
   client-side** in Asia/Jerusalem. A **"שעות בגוגל ↗"** link (via `mapsUrl`)
   covers holiday/temporary-closure hours we can't know. Rejected the Google
   Places API (needs a billed key + proxy route + CSP change for ~5% more
   accuracy).
9. **Sort/filter state persists to both the URL and localStorage.** URL wins on
   load (shareable/bookmarkable), else localStorage, else defaults.
10. **Extract a shared `CoffeeReviewFormFields`.** We're adding the same ~7 field
    groups to both forms; building them once prevents guaranteed drift.

## Data model (`src/types/coffee.ts`, stays import-free)

Category registry gains `pastry`; `price` label → `שווי`:

```ts
export type CoffeeCategory =
  | 'coffee' | 'food' | 'pastry' | 'atmosphere' | 'price';
// COFFEE_CATEGORIES order: coffee, food, pastry, atmosphere, price
// price label: 'שווי'   pastry label: 'מאפים'
```

`CoffeeReviewRatings` gains `tomPastryRating`, `tomerPastryRating`.

New **place-level, all optional** fields on `CoffeeReview` /
`CreateCoffeeReviewDto`:

| Field | Type | Notes |
|---|---|---|
| `coffeePriceIls` | `number` | ₪, ≥ 0; drives tier badge + price sort |
| `coffeeDrinkLabel` | `string` | e.g. `"הפוך"`; ≤ 40 chars |
| `triedItems` | `{ name: string; priceIls?: number }[]` | ≤ ~20 rows; name ≤ 60, price ≥ 0 |
| `tomNotes` / `tomerNotes` | `string` | plain text, ≤ 500 chars, newlines preserved |
| `tags` | `string[]` | ids from `COFFEE_TAGS` |
| `area` | `string` | one of `COFFEE_AREAS` (incl. `אחר`) |
| `lat` / `lng` | `number` | enrichment-only; not hand-edited |
| `openingHours` | `OpeningHours` | 7 entries; each `{open,close}` (`"HH:MM"`) or `null` = closed |

New import-free registries + helpers in the same file:

- `COFFEE_TAGS: {id,label,emoji}[]` — `💻 ידידותי לעבודה · 🌳 ישיבה בחוץ · 🐕 ידידותי לכלבים · 🥑 בראנץ׳ · 🌱 אופציות טבעוניות · 🥡 טייק-אווי · 🤫 שקט/רגוע · 👥 מתאים לקבוצות · ❄️ מיזוג · 😖 קפה מר`.
- `COFFEE_AREAS: string[]` — `פלורנטין · נווה צדק · לב העיר/מרכז · הצפון הישן · הצפון החדש · כרם התימנים · רוטשילד · שפירא · באזל · יפו · אחר`.
- `resolveTags(v): string[] | null` — mirrors `resolveDisabledCategories` (unknown ids → 400).
- `priceTier(ils?): 0|1|2|3` — 0 = unknown; thresholds tuned to TLV (e.g. ≤14 → ₪, ≤18 → ₪₪, else ₪₪₪), documented as constants.
- `reviewerGap(review): number` — `|scoreReview.tom − scoreReview.tomer|`; used by the controversy badge/stat (needs both reviewers rated).
- `isOpenNow(hours, at = new Date()): boolean` — pure; derives Asia/Jerusalem weekday + `HH:MM` via `Intl` (no import) so it's unit-testable with a fixed `at`.

`scoreReview()` is unchanged in shape — it just iterates the now-5-category
registry. Equal weight preserved.

## Enrichment pass — task #1 (Phase 0, data-only)

Runs against a read/write `MONGO_URI` the user drops into `.env.workout`
(deleted afterward). For each place **missing** data, a research sub-agent
(web search) resolves: `photoUrl`, Google `mapsUrl`, Instagram **profile** link,
`lat`/`lng`, `area` (mapped to a `COFFEE_AREAS` value), and weekly
`openingHours`.

- **Fill-empty-only:** write a field only when it is currently empty; **never**
  touch ratings, `tomNotes`/`tomerNotes`, `triedItems`, or `tags`. Re-runnable.
- **Photos verified:** each candidate URL must return `200` + `image/*` before
  use; prefer stable hosts. **Instagram is a profile link, not an image**
  (CDN image URLs expire/hotlink-block).
- **Applied directly** (no per-place approval), via a Node script run with
  `/opt/homebrew/bin/node`.

## API (`coffee-reviews/route.ts` + `[id]/route.ts`)

Extend POST/PATCH validation for every new field: pastry ratings validated
exactly like the others (0–10, 0.5 steps); `coffeePriceIls`/`triedItems[].priceIls`
non-negative numbers; string length caps; `tags` via `resolveTags`; `area` in
`COFFEE_AREAS`; `openingHours` shape/`HH:MM` validated; `lat`/`lng` range-checked.
PATCH keeps the "only touch fields the client sent" rule. GET is unchanged (the
client owns sort/filter now; the server's combined-sort stays as a harmless
default). Same `mekafkefim:write` gate throughout.

## Card (`CoffeeReviewCard.tsx`)

- Pastry ring joins the grid (5 rings; disabled/unrated states unchanged).
- **Headline = active sort metric** (passed down from the page), overall secondary.
- **₪ price + ₪/₪₪/₪₪₪ badge**, `coffeeDrinkLabel`, and **tags chips**.
- **Tried-items** list; **per-reviewer notes** inside the תום/תומר tabs.
- **פתוח עכשיו / סגור** badge (from `isOpenNow`) + **שעות בגוגל ↗** link (only
  when `mapsUrl` exists).
- **🔥 controversy badge** when `reviewerGap ≥ 2.0`. Area shown.

## Discovery UI (`page.tsx` + new components)

- **Sort:** metric (`coffee`(default)/`overall`/`food`/`pastry`/`atmosphere`/
  `value`/`coffeePrice`/`date`/`name`) × perspective (`combined`/`tom`/`tomer`,
  greyed for place-level metrics), asc/desc. **Blanks/unrated always sink** to
  the bottom regardless of direction.
- **Filters:** name search · area (multi) · tags (multi) · price tier · min
  coffee score · has-photo · hide-unrated · **פתוח עכשיו**. AND across types,
  OR within a type.
- **State ↔ URL query + localStorage** (URL wins on load).
- **Stats header (6 tiles):** ☕ מלך הקפה · 💰 הכי משתלם · 🪙 הכי זול ·
  🔥 הכי שנוי במחלוקת · 📊 מחיר ממוצע · 🏙️ סה"כ בתי קפה. Each computed
  client-side, skipping places lacking the needed data.

## Forms

Extract **`CoffeeReviewFormFields`** (+ a small shared state hook) rendered by
both Add and Edit. New inputs: pastry rating, coffee price + drink label,
tried-items editor (add/remove rows), per-reviewer notes, tags chip-picker,
area select, and a **collapsible** opening-hours editor. `lat`/`lng` are not
hand-edited. Legacy documents keep working.

## Map — part of #6 (deferred)

Coordinates are collected now, but the Leaflet map (grid ↔ map toggle, pins
colored by score) is a later phase — it's the only piece adding npm deps
(`leaflet` + `react-leaflet`, dynamic-imported, `ssr:false`) and it's low-value
for ~25 pins in one city versus the area filter. Tile hosts are already in the
CSP from `/trip.html`.

## Testing

Extend `src/lib/__tests__/coffee-score.test.ts` (keep `coffee.ts` import-free):
- registry is the **five** categories in order (updates the existing assertion);
- `pastry` participates in / is excludable from the average;
- `priceTier` thresholds; `reviewerGap`; `resolveTags` (valid/dup/invalid);
- `isOpenNow` with fixed `at` across open / closed / closed-day cases.

## Phasing

1. **Model + API + tests** — `coffee.ts` registries/fields/helpers, API
   validation, updated tests. No behavior change visible yet.
2. **Card + shared forms** — display and capture the new fields.
3. **Discovery UI + stats** — sort/filter/search/persistence/stats header.
4. **Enrichment run** — populate the new place-level data (photos/maps/IG can be
   run earlier since those fields already display).
5. **(Optional, deferred)** Map view.

Each phase is independently shippable and leaves `/mekafkefim` working.
