# Shopping: nutrition facts

Design, 2026-11-17; the owner's answers are in § Decisions. Two parts:
nutrition on the product view, and a nutrition hero on the list, hidden behind
a settings gear.

## The catch: the price files have no nutrition

The regulated price files carry name, maker, quantity and unit, nothing else
(see [shopping-in-store-mode.md](shopping-in-store-mode.md) § Departments). So
nutrition comes from another source and is matched to our items. Coverage will
be partial, and the UI says so.

## Source: the Ministry of Health's national nutrition database (צמרת)

Chosen by the owner over Open Food Facts, which works badly for us (photos
research: 33/100 top items with a front image; the API search loop fails).

| | |
|---|---|
| Dataset | data.gov.il `nutrition-database`, "מאגר התזונה הלאומי הישראלי", Ministry of Health (Nutrition Department) |
| Licence | "Other (Open)" on data.gov.il. **To do:** read the dataset page's terms for attribution wording; credit "משרד הבריאות – מאגר התזונה הלאומי" where values are shown |
| Foods | `moh_mitzrachim.csv`: **4,624 foods**, values **per 100 g**, 74 nutrients, an update date per row (`tarich_idkun`). Dataset last modified 2023-03 |
| Units | `moh_yehidot_mida_lemitzrachim.csv`: 19,024 rows (food code × measure → grams), e.g. "יחידה בינונית", "כוס"; measure names in `moh_yehidot_mida.csv` (108 measures) |
| Recipes | `moh_matkonim_*.csv`, ~1,400 cooked dishes. Not needed |
| Barcodes | **None.** Matching is by name and maker |

It holds both **branded Israeli products** and **generic foods**, checked on
2026-11-17 through the data.gov.il datastore API:

- "חטיף בוטנים, במבה, אסם": 534 kcal, protein 17.5, sugars 3.2, sodium 390
- "חלב 3% שומן, תנובה, טרה, הרדוף, יטבתה": 60 kcal, protein 3.3, sugars 4.6, sodium 50
- "מעדן חלב, יוגורט, דני, 3% שומן, תות, שטראוס"
- Raw produce, staples and cooking ingredients as generic rows.

Columns we keep: `food_energy` (kcal), `protein`, `carbohydrates`,
`total_sugars`, `total_fat`, `saturated_fat`, `total_dietary_fiber`, `sodium`
(mg). All are per 100 g, liquids included (milk is per 100 g, ≈ per 100 ml).

## Matching our items to MoH foods (the core risk)

A pure, import-free matcher in `src/lib/shopping/nutrition-match.ts`, tested
with `node --test` on fixtures (real item names → expected MoH codes):

1. **Normalize** both sides: Hebrew spelling variants (עגבניה / עגבנייה, single
   vs. double ו/י), units and sizes removed from our names ("80 גרם"), the
   same prefix rules as `departmentOf`.
2. **Split the MoH name** on commas into head ("חטיף בוטנים"), variants ("במבה",
   "3% שומן", "תות") and makers ("אסם", "שטראוס"; the last segments that match
   a known maker list built from our items' `m`).
3. **Score** each candidate:
   - every **number** in the name must agree ("3%" ≠ "1%"), or it's out;
   - **maker** equal to our `m` (or one of `s`'s makers): strong bonus;
   - share of the MoH variant words found in our name (the most words wins:
     "במבה נוגט" beats "במבה" for "במבה במילוי נוגט");
   - **department** compatible (our `d` vs. a small MoH-head → department map).
4. **Tiers**: `brand` (maker + all variant words), `generic` (head word + department,
   no maker, e.g. loose "עגבניות" → the raw tomato row). Below the threshold → no
   match. A wrong value is worse than none.
5. **Coverage report** every run, like departments: "nutrition: 31% of items
   (brand 12%, generic 19%), 58% weighted by stores", plus the top 50 unmatched
   items by store count, so rules get better where it matters.

## Part 1: nutrition on the product view

In `ProductSheet`, under the prices, a section **"ערכים תזונתיים"**:

```
ערכים תזונתיים                        ל־100 גרם │ ליחידה (25 ג׳) │ לאריזה (200 ג׳)
אנרגיה (קק״ל)                              534  │ 134            │ 1,068
חלבונים (ג׳)                               17.5 │ 4.4            │ 35
פחמימות (ג׳)                               …
  מתוכן סוכרים (ג׳)                        3.2  │ 0.8            │ 6.4
שומנים (ג׳)                                …
  מתוכם שומן רווי (ג׳)                     …
סיבים תזונתיים (ג׳)                        …
נתרן (מ״ג)                                 390  │ 98             │ 780
                 מקור: משרד הבריאות – מאגר התזונה הלאומי
```

- **Per 100 g always.** Per pack from the item's `q` + `uq` (גרם, ק״ג, מ״ל,
  ליטר). A **per-unit column** only for multipacks and unit-sold items: the
  unit weight from the name ("8 × 25 גרם") or from the MoH units table
  ("יחידה בינונית" of a cucumber, an egg).
- **Red-label chips** derived from the values (below). Labelled "לפי הערכים";
  the package is the source of truth.
- `generic` matches say "ערכים למוצר כללי: עגבנייה, טרייה".
- **"לא המוצר הנכון?"**: search the MoH foods and pick the right one (saved for
  everyone), or "אין התאמה" to clear a wrong match. Typing values is a last
  resort, from the same sheet.
- Credit line as above.

**Layout inspiration (to do).** The owner asked to model the table and the
multipack display on how existing sites show it. A fetch of Open Food Facts,
Rami Levy and Yochananof product pages returned nothing (pages are rendered by
JavaScript or the host failed), so this needs a look in a real browser:
2–3 Israeli grocery sites and OFF, screenshots into this doc, then settle the
columns above.

## Red-label thresholds (Israeli front-of-package warning)

The regulation's **stage 2, in force since 1 January 2021**:

| Per 100 | Sodium | Total sugars | Saturated fat |
|---|---|---|---|
| Solid (g) | > 400 mg | > 10 g | > 4 g |
| Liquid (ml) | > 300 mg | > 5 g | > 3 g |

Sources: the solid values agree in Campden BRI's summary and Gillon-Keren et
al., *Nutrients* 2020;12(6):1875 (PMC7353345, Appendix B). The **liquid values
come from that paper alone** and must be checked against the regulation text
(תקנות בריאות העם (מזון) (סימון תזונתי), § 5) before shipping. Exempt from the
label on packages: non-prepacked food (produce, loose meat) and packages under
25 cm²; our chips skip `generic` produce matches. Constants in
`nutrition.ts`, `RED_LABEL = { solid: {...}, liquid: {...} }`. Liquid = the
item's unit is מ״ל/ליטר.

## Part 2: the list's nutrition hero (hidden by default)

- **Settings gear** at the top of `/shopping`, like the workout app's header
  menu (`src/components/workout/ProfileMenu.tsx`): one button opening a small
  menu of the page's preferences. First entry: **"ערכים תזונתיים ברשימה"**
  (off by default). Later the club toggles and the like can move there too.
- The setting is per user, saved server-side like the workout settings, so
  it follows the user across phones: `shoppingUserSettings { _id: email,
  nutritionHero: boolean }`, `GET/PUT /api/shopping/settings`.
- When on, a compact hero at the top of the **רשימה** step:

```
┌──────────────────────────────────────────────┐
│  בסל הזה                                       │
│  12,400 קק״ל · 610 ג׳ חלבון                    │
│  380 ג׳ סוכר · 9.2 ג׳ נתרן                     │
│  לפי 14 מתוך 20 מוצרים                         │
└──────────────────────────────────────────────┘
```

- **Four totals**: calories, protein, sugar, sodium. Σ over list items with
  values: per-100 × pack (or unit) grams ÷ 100 × qty; weighted items qty kg × 10
  × per-100.
- **Coverage line** always shown. Under half the items: the hero dims and says
  "חלקי".
- **Tap to expand**: the top 3 items per total (chips: קלוריות, חלבון, סוכר,
  נתרן), red-label items in the list, and the items with no values ("להוסיף").
- Computed on the client; nothing stored per list.

## API

- `GET /api/shopping/nutrition?keys=…` (≤ 200 keys) → `{ [key]: { nu, pack, unit } }`
  for the hero and the sheet. The compare response stays as it is.
  ```ts
  interface Nutrition {
    kcal: number | null; p: number | null; c: number | null; s: number | null;
    f: number | null; sf: number | null; fib: number | null; na: number | null; // per 100 g; na in mg
    code: number;                 // MoH food code
    by: 'brand' | 'generic' | 'picked' | 'manual';
  }
  ```
- `GET /api/shopping/nutrition/foods?q=` → MoH foods search (Atlas Search, see
  below) for "לא המוצר הנכון?".
- `PUT /api/shopping/nutrition` `{ item, code | values | null }`: a user's pick,
  typed values, or "no match". Permission `shopping`.
- `GET/PUT /api/shopping/settings` for the gear.
- Pure helpers in `src/lib/shopping/nutrition.ts` (import-free):
  `packGrams(q, uq, name)`, `unitGrams()`, `itemTotals()`, `listTotals()`,
  `redLabels()`.

## Data model

- **Item doc `nu`** (ingest-written): the `Nutrition` above. ~90 B × matched
  items (say 15k) ≈ 1.4 MB on M0.
- **`shoppingNutritionFoods`** (ingest-written, new): the 4,624 MoH foods, only
  the kept columns + unit weights: `{ _id: code, n, kcal, p, c, s, f, sf, fib,
  na, units: [{ name, g }] }`, ≈ 1.5 MB. Read by the "pick the right food"
  search and by `picked` items.
- **`shoppingNutritionFixes`** (app-written, new): `{ _id: itemKey, code |
  values | none, by, at }`, read **over** the ingest's `nu`, so a user fix
  survives every ingest. The ingest also reads it, so a `picked` code is
  written into `nu` on the next run.
- **`shoppingUserSettings`** (app-written, new), above.

## Ingest and Atlas build (part of the normal run)

No separate command; nutrition is a step of `npm run shopping:ingest`:

1. **Fetch** the MoH CSVs into the cache (`nutrition/moh/*.csv`), refreshed when
   data.gov.il's `metadata_modified` changes (one `package_show` call per run),
   never re-downloaded otherwise. `--offline` uses the cached copy.
2. **Match** every item (`nutrition-match.ts`), with `shoppingNutritionFixes`
   taking priority. Set `nu` on the item docs before hashing, so only changed
   docs are written, as today.
3. **Write** `shoppingNutritionFoods` (hash-guarded like the other collections).
4. **Atlas Search**: a `foods_search` index on `shoppingNutritionFoods.n`,
   defined next to `ITEMS_SEARCH_INDEX` in `src/lib/shopping/search-index.ts`
   and created by the same `shopping:search-index` step. Docker Mongo falls
   back to a regex search, as items do.
5. Log the coverage report (above).

## Decisions (owner, 2026-11-17)

1. **Source**: the MoH national nutrition database, inside the ingest and the
   Atlas build. Not Open Food Facts.
2. **Hero totals**: calories, protein, sugar, sodium.
3. **No "household days"** estimate.
4. **Multipacks / per-unit display**: model on existing sites (to do, above).
5. **Red-label thresholds**: checked against the regulation (above); liquids
   still need the regulation text.
6. **Hero hidden** behind a top settings gear, as in the workout app.

## Still open

1. **Match quality**: what share of the list items the household buys gets a
   `brand` match? Measured in step 1 below; if low, generic matches carry the
   hero and "לא המוצר הנכון?" matters more.
2. **Data age**: rows have their own update dates (dataset modified 2023-03).
   Show the row's date in the sheet, or only the source?
3. Show a 🔴 chip in search results, or only in the sheet?

## Order of work

1. **Spike**: download the CSVs, build `nutrition-match.ts` against ~200 of our
   most-sold items, and write brand / generic / none rates here. Confirm the
   licence wording and the liquid thresholds in the regulation text. Look at
   2–3 sites' nutrition tables in a browser.
2. Ingest step: fetch, match, `nu`, `shoppingNutritionFoods`, coverage log.
3. Product view section (per 100 / unit / pack, chips, credit).
4. Settings gear + `shoppingUserSettings`; the list hero.
5. "לא המוצר הנכון?" (foods search index, fixes collection).
6. Later: healthier swaps by nutrient within a department.
