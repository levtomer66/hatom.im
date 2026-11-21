# Calories counter (`/calories`): design

Design, 2026-11-21. A new permission-gated feature: each person keeps a private
food diary against a daily calorie goal, reusing /shopping's product catalog,
nutrition facts, search and barcode scanner.

## What the owner asked for

| Question | Answer |
|---|---|
| Who logs | **Each person their own log.** Anyone with the `calories` permission has a private diary and goals; nobody sees anyone else's. |
| What gets logged | **All of:** packaged products (barcode or search), generic foods (an egg, a slice of bread), home-made meals (a saved recipe, logged by portion), quick add (a name + kcal). |
| Goals and views | **A daily calorie target + the week:** today's eaten vs left, meals grouped, a 7-day chart. An optional protein goal. |
| Link to /shopping | **Two-way:** read the catalog and My items, and "add to the shopping list" from a logged product. |
| Generic-food source | **Approach A:** load the Ministry of Health national nutrition table (צמרת) into a small collection with a local script. (Rejected: a hand-written list of ~150 foods; products-only.) |

Success: logging an egg, a scanned yogurt or "my shakshuka" takes two or three
taps; the day screen answers "how much is left today?" at a glance.

## Screens (Hebrew, RTL, mobile-first, shopping's look)

### Day screen (`/calories`, home)

- **Top row**: ‹ date › arrows (opens on today), ⚙ (goals, הארוחות שלי).
- **Ring**: eaten / goal, "נשארו N" in the middle (over the goal: "N מעל", in
  the warning colour). Under it one line: protein · carbs · fat in grams. With a
  protein goal, a second small bar for protein.
- **Meal cards**: בוקר, צהריים, ערב, נשנושים, each with its kcal subtotal and a ＋.
  An entry row: photo (`Thumb`), name, amount ("2 × יחידה בינונית", "150 גרם"),
  kcal. Swipe to delete (`SwipeRow`); tap to edit the amount or move it to
  another meal.
- **Week**: 7 bars, the last 7 days ending on the shown day, with a goal line.
  Tapping a bar opens that day.

### Add sheet (bottom sheet, drag down to close — `useSwipeToClose`)

- Opened from a meal's ＋ (that meal), or the top ＋, which picks the meal by
  the device's hour (`defaultMeal`: < 11 בוקר, < 16 צהריים, < 21 ערב, else
  נשנושים).
- Search box and 📷 (shopping's `Scanner`).
- **Before typing**: *אחרונים* (the person's last 15 foods, each with its last
  amount: one tap logs it again), *My items* chips (only with the `shopping`
  permission), and *הוספה מהירה* (name + kcal; protein, carbs, fat optional).
- **Results** in three groups: הארוחות שלי, מזון כללי (MoH), מוצרים (catalog).
- **Amount step** after a pick: unit chips — גרם, the pack ("אריזה · 200 ג׳",
  when the pack size is known; not for weighed items), the MoH portions
  ("יחידה בינונית · 50 ג׳", "כוס · 240 ג׳"), or a home-made meal's portion —
  a quantity stepper, live kcal + protein, "הוספה".
- **A product with no nutrition values**: the amount step turns into
  "אין ערכים — מהאריזה, ל־100 גרם": kcal required, protein/carbs/fat optional,
  checked by `plausible()`, saved per barcode for everyone (`caloriesLabels`),
  then logged.
- **A scanned code with no product**: "לא מצאנו את הברקוד" and the search box.

### הארוחות שלי (home-made meals)

A list, and an editor: name, number of portions, ingredients (picked with the
same search + amount step, stored as grams). Per-portion values are computed
and shown; logging asks for portions (½, 1, 2…).

### Goals (⚙)

Daily kcal goal (asked on the first visit, default 2000) and an optional
protein goal (g).

### Shopping link

A logged product's edit sheet has "🛒 לרשימה" (only with `shopping`): adds one
unit to the household's list (and to My items, as search does) through `POST /api/calories/to-list`.

## Permission, route, config

- New `PermissionKey` `'calories'` in `src/types/permissions.ts` (and
  `PERMISSION_KEYS`), a middleware pattern + matcher entry for `/calories`, a
  card on the home page like the other features.
- `src/lib/calories/config.ts`: `CALORIES_BASE_PATH = '/calories'`,
  `CALORIES_API_PATH = '/api/calories'`.
- Every route: `requireFeatureCaller(request, 'calories')`. The person is the
  caller's email; no client-sent id decides whose data is read or written.

## Data (Mongo M0: every collection small)

| Collection | One doc per | Fields | Size |
|---|---|---|---|
| `caloriesDays` | person × day | `_id: "<email>|YYYY-MM-DD"`, `entries: Entry[]` (max 60), `updatedAt` | ~3 KB/day |
| `caloriesUsers` | person | `_id: email`, `goal`, `proteinGoal: number \| null`, `recent: Recent[]` (max 15) | < 2 KB |
| `caloriesMeals` | home-made meal | `_id` (ObjectId), `owner` (email), `name`, `portions`, `items: { ref, name, grams, nu }[]` (max 40), `per: Totals` (one portion), `updatedAt` | ~1 KB |
| `caloriesFoods` | MoH food | `_id: code`, `n`, `nu: Nutrition` (shopping's shape, `by: 'moh'`), `units: { name, g }[]`, `h` (content hash) | ~1.5 MB total |
| `caloriesLabels` | barcode | `_id: barcode`, `nu: Nutrition` (`by: 'manual'`), `by` (email), `at` | tiny |

```ts
type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
interface Totals { kcal: number; p: number; c: number; f: number }   // grams, kcal
interface Ref { kind: 'product' | 'food' | 'meal' | 'quick'; key: string | null }
interface Entry {
  id: string;            // random, per entry
  meal: Meal;
  name: string;
  img: string | null;
  ref: Ref;
  unit: { name: string; g: number };   // "יחידה בינונית", 50 — or "גרם", 1 / "מנה", g of one portion
  qty: number;
  nu: Totals;            // this entry's totals, frozen when logged
  at: string;            // ISO
}
interface Recent { ref: Ref; name: string; img: string | null; unit: Entry['unit']; qty: number; per100: Totals | null; per?: Totals }
```

- **Frozen values**: an entry keeps its totals; later catalog fixes, label
  edits or a deleted home-made meal never change past days. The day view is one
  read with no joins.
- Quick add entries: `ref.kind: 'quick'`, `unit: { name: 'מנה', g: 0 }`,
  `qty: 1`, `nu` as typed.
- Two people at ~30 entries a day ≈ 2 MB a year.
- Indexes: `caloriesMeals.owner`. Days are read by `_id` only.

## API (`/api/calories/…`)

| Route | Does |
|---|---|
| `GET day?date=YYYY-MM-DD` | entries for the day, the person's goals, and the 7 days' totals ending on `date` (one `find` over 7 `_id`s) |
| `POST day` `{ date, entry }` | `$push` one entry (validated by `parseEntry`; ≤ 60 per day); updates `recent` |
| `PATCH day/[id]` `{ date, meal?, qty? }` | changes one entry; `nu` rescaled by qty |
| `DELETE day/[id]?date=` | `$pull` one entry |
| `GET search?q=` | `{ meals, foods, products }`, each hit with `nu` per 100 g (meals: per portion), name, img, units |
| `GET product?key=` | after a scan: name, img, `nu` (the item's `nu`, else `caloriesLabels`), `pack` grams, `w`, liquid; 404 when no item |
| `PUT label` `{ key, nu }` | typed package values for a product (`parseLabel` + `plausible`) |
| `GET/PUT settings` | goals |
| `GET/POST meals`, `PATCH/DELETE meals/[id]` | home-made meals, owner only |
| `POST to-list` `{ key, name, w }` | 🛒: one unit onto the household list and My items (needs `shopping` too) |

- **Products search** reuses shopping: the doc-finding half of
  `searchProducts` in `src/lib/shopping/service.ts` (Atlas Search with the
  regex fallback, the typo retry, `rankHits`) moves into
  `findProducts(q): Promise<ItemDoc[]>`. `searchProducts` calls it and prices
  the hits as today; calories calls it with no stores and no prices. Barcodes
  try the code as-is and without leading zeros (`candidates`).
- **Foods search**: a regex over `caloriesFoods.n` with `searchPatterns`,
  ranked by `rankHits`; ~3,000 docs need no index.
- **🛒** `POST /api/calories/to-list` `{ key, name, w }`: re-checks the caller's `shopping` permission (`requireFeatureCaller(request, 'shopping')`), then `ensureMyItems` + `addLines` on `householdFor(email)`. (Shopping's own `POST home/list` only adds keys that are already My items, so it can't be reused as is.) My items come from the existing `GET /api/shopping/home`.
- "Today" is the device's local date, sent as `date` (as in /calendar).

## Pure logic (import-free, `node --test`)

`src/lib/calories/calories.ts`:

- `entryTotals(per100, grams)`, `scaleTotals(t, factor)` (rounding: kcal to 1,
  grams to 0.1);
- `mealPerPortion(items, portions)`;
- `dayTotals(entries)`, `mealTotals(entries)`;
- `weekBars(days, endDate, goal)` (7 dates back across months and years);
- `defaultMeal(hour)`;
- `unitsFor({ units?, pack?, w, liquid })` → the chips (`גרם` first; `מ״ל`
  for liquids);
- `parseEntry`, `parseLabel`, `parseSettings`, `parseMeal` (validation:
  qty ≤ 5,000 g of grams, names ≤ 80 chars, numbers finite and ≥ 0);
- `pushRecent(recent, item)` (dedupe by ref, newest first, max 15).

It reuses `forGrams`, `packGrams`, `isLiquid` and `plausible` from
`src/lib/shopping/nutrition.ts` (import-free) by relative import.

`src/lib/calories/moh.ts`: MoH datastore rows → `caloriesFoods` docs (below).

## The MoH loader: `npm run calories:foods`

A local, hand-run script, wired like `shopping:ingest`:
`node --env-file-if-exists=.env.shopping src/lib/calories/moh-cli.ts`
(`moh-cli.ts` fetches and writes; the mapping is in the pure `moh.ts`):

- Reads the data.gov.il **datastore API** (`datastore_search?resource_id=…&limit=5000&offset=…`)
  for the foods, unit weights and unit names tables. The CSV URLs answer 403 to
  scripts; never work around that.
- Keeps `makor` 1, 2, 3 (generic, manufacturer, manufacturer label); drops 4
  (home recipes) and FFQ survey rows.
- Maps `food_energy, protein, carbohydrates, total_sugars, total_fat,
  saturated_fat, total_dietary_fiber, sodium` to `Nutrition`; drops rows that
  fail `plausible()`.
- `units`: "100 גרם" first, then the food's measures (name → grams) from the
  unit tables.
- Writes only docs whose content hash changed (bulk upsert); `--dry-run` prints
  counts. `MONGODB_URI` from `.env.shopping`. Raw JSON cached under
  `~/.cache/hatom-shopping/moh/` (outside the repo: writes under the repo
  trigger the `next dev` recompile loop).
- Credit, required by the data.gov.il licence, wherever an MoH value is shown:
  "מקור: משרד הבריאות, מאגר התזונה הלאומי (data.gov.il)". Shopping's
  `SOURCE_TEXT.moh` already has it.

## Errors and edge cases

- Save fails (offline, 500): the row stays dimmed with "לא נשמר — נסה שוב". No
  offline queue.
- Over the limits (60 entries a day, qty above 5,000 g, a name above 80 chars):
  400 with a Hebrew message.
- Product without pack size: grams only. Weighed product (`w`): grams only.
- Product without `nu` and no label typed: the label form (above).
- Atlas Search down: shopping's regex fallback, unchanged.
- Settings missing on first visit: the goal prompt; nothing else blocks.

## Testing

- `node --test`: `calories-*.test.ts` for the pure helpers (totals, portions,
  units, `defaultMeal`, validation, `weekBars` across a month and a year,
  `pushRecent`) and `moh.ts` (row mapping, `makor` filter, units) on a small
  saved fixture.
- The shopping tests still pass after the `findProducts` split.
- In the browser, at 375 px, on `npm run dev:local` with Docker Mongo (and a
  local loader run into Docker): goal setup; log a product, an MoH food and a
  home-made meal by search; quick add; edit and swipe-delete; the week bars and
  moving between days; 🛒 to the list; typing a label for a product without
  values. The scanner needs a camera: its path is checked with a typed barcode.

## Out of scope

Weekly or macro goals beyond protein; seeing or logging for other people;
reading labels with AI; an MCP tool for calories (a later step); an offline
queue; exporting data.
