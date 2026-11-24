# Recipes (`/recipes`)

A personal recipe book: add, view and share recipes; send their ingredients to
the shopping list; log a serving to /calories; import recipes from social media
through Claude (MCP). Asked for by the owner on 2026-11-24; every decision below
was agreed in the brainstorm that day.

## What the owner asked for

1. Easily add, view and share recipes.
2. Integrated with the products of the shopping list.
3. Integrated with /calories.
4. Importing recipes from social media, converted to Israeli units and products.

Owner's answers:

- Recipes are **per person**, and one can be **shared to a feed**. Others can
  view a feed recipe and copy it into their own book; they can't edit it.
- Sharing outside the site = the phone's share sheet with a WhatsApp-friendly
  text. No public pages.
- Recipes are **their own app**, not calories meals. They integrate with
  calories (log a serving; recipes in the calories search), nothing more.
  `caloriesMeals` is not touched.
- 🛒 = a **tick sheet** of products, one per ingredient.
- Import happens **in the owner's Claude chat through the hatom MCP
  connector**, not with an API key in the app. The page only explains it and
  copies a ready prompt.
- Imported recipes are in **Hebrew with Israeli units and products**, each line
  keeping its original, and are auto-linked to products/foods.
- Photos are **uploaded to Vercel Blob**; an imported image URL is copied into
  Blob once.
- Extras in v1: tags + search, cooking mode, prep/cook time, log to calories.
- No save buttons: every editor saves as you change it.

## Data

One Mongo collection, **`recipes`**, one doc per recipe (model
`src/models/Recipe.ts`, typed functions like the other models).

```ts
interface RecipeDoc {
  _id: ObjectId;
  owner: string;              // session email
  name: string;               // ≤ 120
  servings: number;           // 1–100, what the amounts are written for
  ingredients: Ingredient[];  // ≤ 60
  steps: string[];            // ≤ 40, each ≤ 1000
  tags: string[];             // ≤ 10, each ≤ 30, trimmed, deduped
  prepMin: number | null;     // 0–1440
  cookMin: number | null;     // 0–1440
  photo: string | null;       // Vercel Blob URL
  notes: string;              // ≤ 2000
  source: { url: string | null; by: string | null } | null; // where it was imported from
  shared: { at: string } | null; // on the feed since
  copiedFrom: { id: string; owner: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface Ingredient {
  id: string;                 // stable per line (for React keys and autosave)
  text: string;               // the line as shown, "2 כוסות קמח לבן" (≤ 200)
  qty: number | null;         // parsed from text; null = "לפי הטעם"
  unit: string | null;        // a UNITS key ("כוס", "כף", "גרם", …) or null = pieces
  name: string;               // the ingredient without amount/unit, "קמח לבן"
  grams: number | null;       // for nutrition; estimated from qty+unit, editable
  link: Link | null;          // nutrition source
  key: string | null;         // shopping product for 🛒, when different from link
  orig: string | null;        // the original line before conversion ("2 cups flour")
  alt: string | null;         // substitution note ("heavy cream → שמנת מתוקה 38%")
  auto: boolean;              // link/key were picked by the server, not checked yet
}

interface Link {
  ref: { kind: 'product' | 'food'; key: string };  // calories' Ref, minus meal/quick
  name: string;
  img: string | null;
  per100: Totals;             // calories' Totals, frozen at link time
}
```

Indexes: `{ owner: 1, updatedAt: -1 }`, `{ 'shared.at': -1 }` (partial, shared
only). A recipe is a few KB; nothing binary is stored.

**Nutrition is derived, never stored**: per serving = sum over lines with
`link` and `grams` of `per100 × grams / 100`, divided by `servings`.
`partial` = some line with a `qty` has no `link`/`grams` (lines with `qty:
null`, "מלח לפי הטעם", don't count against it). Uses calories' import-free
`sumTotals` from `src/lib/calories/calories.ts`.

## Pure logic — `src/lib/recipes/*.ts` (import-free, `node --test`)

- **`units.ts`**: the unit table. Volume in ml (כוס 240, חצי כוס 120, כף 15,
  כפית 5, מ״ל 1, ליטר 1000), weight in g (גרם, ק״ג), pieces (יחידה, ביצה, שן,
  קורט = 0). Hebrew spellings and plurals map to one key (כוסות→כוס, כפות→כף).
  `toGrams(qty, unit, name)`: weight units exactly; volume × density, with a
  small density table for common names (קמח 0.53, סוכר 0.85, אורז 0.8, שמן
  0.92, חמאה 0.96, דבש 1.4; default 1); pieces via a small table (ביצה 55, שן
  שום 5, בצל 150; else null). US→metric for the MCP tool's guidance and for
  English lines: cup 240 ml, tbsp 15, tsp 5, oz 28 g, lb 454 g, stick of
  butter 113 g, °F→°C rounded to 5.
- **`line.ts`**: `parseLine(text)` → `{ qty, unit, name }`. Numbers: digits,
  decimals, fractions (½ ¼ ¾ ⅓, "1/2", "1 1/2"), Hebrew words (חצי, רבע, אחד,
  שתיים … עשר). Unit right after the number. "לפי הטעם", "קורט" → `qty: null`.
  Anything unparsed stays as `name` with `qty: null`.
- **`scale.ts`**: `scaleLine(ing, factor)` → the text to show for N servings:
  amounts rounded sensibly (to ¼ for cups/spoons, to 5 g above 50 g, whole
  pieces rounded up from .5), the unit's plural form when > 1. Lines with
  `qty: null` unchanged.
- **`nutrition.ts`**: `perServing(recipe)` → `{ totals, partial }`.
- **`recipe.ts`**: `parseRecipePatch(v)` (validation for PATCH and the MCP
  tool, the limits above), `newIngredient(text)`, `copyForFeed(recipe, email)`.
- **`share.ts`**: `shareText(recipe, servings)` → the WhatsApp text:
  `*name*`, servings and time, "מצרכים:" with "• " lines (scaled), "אופן
  הכנה:" numbered, then the source link if any. No hatom.im link (it's gated).
- **`pantry.ts`**: `isPantry(name)` — מלח, פלפל שחור, שמן, שמן זית, מים,
  סוכר, קמח לבן, פפריקה, כמון, סודה לשתייה, אבקת אפייה. Starts unticked in 🛒.

## Screens (phone-first, RTL; wear `shopping.css` + `calories.css` + `recipes.css`)

### `/recipes` — the book

- Head: "מתכונים", ⇩ **ייבוא**, ＋.
- Tabs **שלי** / **פיד**.
- Search box (name, ingredient names, tags; client-side over the loaded list)
  and tag chips from the shown recipes (tap = filter; several = all of them).
- Cards: photo (or a plain tile with the first letter), name, ⏱ prep+cook,
  🔥 kcal per serving ("~" when partial, nothing when no line is linked),
  on the feed the author's name. Mine sorted by `updatedAt`, feed by `shared.at`.
- ＋ creates an empty recipe ("מתכון חדש", 2 servings) and opens it in edit mode.
- **ייבוא** opens a sheet: three short steps (copy the link or take a
  screenshot → open Claude with the hatom connector → paste the prompt) and a
  "העתק" button for the prompt:
  `שמור את המתכון הזה ב-hatom (recipes_save): <paste here>`.

### `/recipes/[id]` — one recipe

- Photo (full width, 4:3), name, ⏱ and tags, the source link ("מ-instagram.com").
- **Servings stepper** (− N +), starts at `servings`; changes only the view.
- **מצרכים**: each line scaled; under it in grey the `orig`; an `alt` note as a
  small "🔁 …" line. Lines with `auto` show a small "לבדוק" dot (owner only).
- **אופן הכנה**: numbered steps.
- **ערכים למנה**: kcal + protein/carbs/fat (calories' `Macros` look), with
  "חלקי — N מצרכים לא מקושרים" when partial.
- **Notes** if any.
- Action row: 🛒 **לרשימה**, 🍳 **בישול**, **רשום מנה**, **שתף**, ⋯.
  - ⋯ (owner): ✎ עריכה, שתף בפיד / הסר מהפיד, מחיקה (confirm).
  - On someone else's feed recipe: **שמור אצלי** instead of ✎/⋯; it opens the copy.
- 🛒 hidden without `shopping`; **רשום מנה** hidden without `calories`.
- **שתף** uses `navigator.share({ text })`, else copies the text ("הועתק").

### Edit mode (the same page, ✎ toggles it; owner only)

Saves through calories' `useAutosave` (one PATCH per change, in order, a change
still waiting is sent on leaving). Fields:

- Photo: tap → file input (`accept="image/*"`, camera on phones) → resized in
  the browser (1600 px long edge, JPEG 0.8, ≈300 KB) → `POST
  /api/recipes/[id]/photo` → the doc's `photo`. "הסר" removes it.
- Name, servings, prep, cook (number fields), tags (chips + text field), notes.
- **Ingredients**: one text field per line; on change `parseLine` fills
  qty/unit/name, and `grams` is re-estimated unless the user set it by hand
  (`gramsSet` flag stays client-side: once edited, the line keeps its grams).
  Per line: 🔗 opens calories' FoodPicker (search parts) with the line's name
  prefilled; a pick sets `link` (and `key` when it's a product), clears
  `auto`. A linked line shows its name and a grams field. ✕ deletes the line.
  "+ מצרך" adds one; Enter in the last line adds the next. ↑↓ reorder.
- **Steps**: textareas, "+ שלב", ↑↓, ✕.

### Cooking mode (`/recipes/[id]?cook=1`, a full-screen layer)

- One step at a time in large type; ‹ › buttons and swipe; "שלב N מתוך M".
- A collapsible "מצרכים" panel (scaled to the chosen servings) where a tap
  crosses a line out (client state only).
- Screen Wake Lock while open (re-requested on `visibilitychange`); where the
  API is missing, nothing breaks.

### 🛒 sheet

- `GET /api/recipes/[id]/match?servings=N` → per line with a `qty`: the
  product to buy (the line's `key`, else its `link` when a product, else the
  best `findProducts(name)` hit), its img, an amount, and `ticked`.
- `ticked` starts false for pantry names and for products already on the
  household list; true otherwise.
- Amount: 1 unit; a weighed product gets `grams × factor / 1000` kg rounded up
  to 0.1 (min 0.1).
- Tap a product → FoodPicker-like product search; the pick is saved on the
  line (`key`, `auto: false`) for next time (owner only; on a feed recipe
  it's just for this time).
- "הוסף N לרשימה" → `POST /api/recipes/[id]/to-list { lines: [{key, qty}] }`
  → `addLines` on the caller's household. **The list only, not My items.**
  Toast "נוסף לרשימה" with a link to /shopping.

### רשום מנה

A small sheet: meal chips (calories' `defaultMeal(hour)` picked), servings
(default 1, step 0.5), date = today. `POST /api/recipes/[id]/log` →
calories' `addEntry` with:
`ref: { kind: 'recipe', key: id }`, `name`, `img: photo`, `unit: { name: 'מנה',
g: grams per serving or 1 }`, `qty`, `nu` = per serving × qty (frozen).
Disabled with a note when no line is linked.

## Calories side (the only changes there)

- `Ref.kind` gains `'recipe'` (calories.ts, its parser, `FoodHit.source`).
- `GET /api/calories/search` adds the caller's recipes whose name matches to
  the `meals` group as `recipeHit(r)` (`ref: {kind:'recipe'}`, per = per
  serving, unit "מנה") — only when the caller also has `recipes` and the
  recipe has nutrition. Logging one goes through the existing entry POST
  (the client already sends `per`/`nu`). Recents work as for meals.
- Nothing reads a recipe on the day view; entries keep their frozen totals.

## API (`src/app/api/recipes/*`, all `requireFeatureCaller(request, 'recipes')`)

| Route | Does |
|---|---|
| `GET /api/recipes` | mine (light: no steps/notes) |
| `POST /api/recipes` | create (optional body = a full recipe) → doc |
| `GET /api/recipes/feed` | shared by anyone, newest first, ≤ 100, with author display name |
| `GET /api/recipes/[id]` | mine, or anyone's shared one; else 404 |
| `PATCH /api/recipes/[id]` | owner; a partial recipe (`parseRecipePatch`); `shared: true/false` |
| `DELETE /api/recipes/[id]` | owner; also deletes its Blob photo |
| `POST /api/recipes/[id]/copy` | a shared (or own) recipe → a new doc of mine, `copiedFrom`, not shared; the photo is copied to a new blob |
| `POST /api/recipes/[id]/photo` | owner; multipart `file` (jpeg/png/webp ≤ 2 MB) → Blob `recipes/<id>-<rand>.jpg`; the old blob is deleted |
| `GET /api/recipes/[id]/match` | the 🛒 sheet's lines (+ `shopping`) |
| `POST /api/recipes/[id]/to-list` | add lines to the household list (+ `shopping`) |
| `POST /api/recipes/[id]/log` | a serving to calories (+ `calories`) |

Route glue (`readJson`, `bad`, `serverError`) in `src/app/api/recipes/_shared.ts`.
Product search in the edit/🛒 pickers reuses `/api/calories/search` when the
caller has `calories`, else a small `GET /api/recipes/products?q=` over
`findProducts` (same hit shape, no prices).

## MCP (`src/lib/recipes/mcp-tools.ts`, registered beside shopping's)

Every tool re-checks `recipes` (and `shopping` for `recipes_to_list`).

- **`recipes_list`** `{ q?, tag?, scope?: 'mine'|'feed' }` → id, name, tags,
  servings, kcal per serving.
- **`recipes_get`** `{ id }` → the full recipe (scaled lines as text).
- **`recipes_save`** `{ id?, name, servings, ingredients: [{ text, orig?, alt? }],
  steps, tags?, prep_min?, cook_min?, notes?, source_url?, image_url? }` →
  creates (no id) or replaces (id, owner only). The description holds the
  import rules: write in Hebrew; amounts in grams/ml or כוס/כף/כפית (cup = 240
  ml); °F → °C rounded to 5; US products → their Israeli equivalent (heavy
  cream → שמנת מתוקה 38%, sour cream → שמנת חמוצה 15%, all-purpose flour →
  קמח לבן, half-and-half → חצי שמנת מתוקה חצי חלב, buttermilk → לבן/רוויון,
  cream cheese → גבינת שמנת 30%, kosher salt → מלח גס, baking soda → סודה
  לשתייה, scallions → בצל ירוק, cilantro → כוסברה), the original line in
  `orig` and the swap in `alt`; one step per action; servings as stated.
  The server parses each line, estimates grams, and auto-links: the best MoH
  food match for nutrition (`searchFoods`), the best catalog product
  (`findProducts`, food departments) as `key` (and as `link` when no MoH
  food matched), all marked `auto: true`. `image_url` (http/https, image
  content-type, ≤ 5 MB, 10 s timeout) is fetched and stored in Blob; a
  failure leaves `photo: null` and says so in the result. Returns the id, the
  page URL and the lines that got no link.
- **`recipes_to_list`** `{ id, servings? }` → adds what the 🛒 sheet would tick by
  default; returns what was added and what was skipped (pantry, already there,
  no product).

## Permission and navigation

New `recipes` key in `src/types/permissions.ts` (after `calories`), the
middleware pattern + `matcher` entry, a Navbar link, the home-page card like
the others, the admin matrix picks it up from `PERMISSION_KEYS`.

## Errors

- Autosave failure: calories' existing "לא נשמר — מנסה שוב" behaviour.
- A feed recipe deleted or unshared while open: the next fetch 404s →
  "המתכון כבר לא משותף" with a link back to the book.
- Photo upload failure: a toast, the old photo stays.
- 🛒 with no matchable product for a line: the line shows "אין מוצר" and
  stays unticked.
- MCP `recipes_save` invalid input: a JSON-RPC tool error naming the field.

## Testing

- `src/lib/__tests__/recipes-*.test.ts`: line parsing (digits, fractions,
  Hebrew words, units, "לפי הטעם"), unit conversion and grams, scaling and
  rounding, nutrition per serving and `partial`, patch validation limits,
  share text, pantry.
- The MCP input mapping (`recipes_save` args → a recipe) is a pure function
  in `src/lib/recipes/` and unit-tested; the tools themselves are exercised
  once by a JSON-RPC call to the local server (there are no MCP tool tests
  in the repo to follow).
- Browser at 375 px on `npm run dev:local -- -p 3260`: create, edit (autosave),
  photo, scale, cook mode, share text, feed + copy, 🛒 to list, log to
  calories, the calories search showing a recipe.

## Not in v1

- A link that works without signing in.
- Importing from inside the app (an API key) or a PWA share target.
- Copying a calories meal into recipes.
- Comments/likes on the feed.

## Import agent (added 2026-11-24, owner's design)

Users import from the page; an agent the owner runs as a cloud Claude Code session
(default environment) does the work — nothing runs on a local machine.

- **Request**: ייבוא opens a form — a link (https) and/or pasted text (a caption),
  optional note. `POST /api/recipes/imports` stores a doc in `recipeImports`
  `{ _id, requester, url, text, note, status: queued|working|done|failed, recipeId,
  error, at, claimedAt, doneAt }` (≤ 5 open per person) and publishes a wake-up to
  the ntfy topic in env `RECIPES_IMPORT_TOPIC` — the message is only the request
  id: ntfy.sh is public, so no email, link or text goes there. Without the env
  var the request is still queued (the agent also polls).
- **Page**: open and recent (24 h) requests show at the top of the book —
  "מייבא…", then a link to the recipe, or the failure reason with ✕ to dismiss.
  Polls every 5 s while one is open.
- **Agent tools** (MCP, owner callers only; they write to the request's
  requester, never to the caller): `recipes_import_queue` (queued ids, plus
  `working` ones claimed > 30 min ago), `recipes_import_claim {id}` (atomic
  queued→working; returns url, text, note and the conversion rules),
  `recipes_import_complete {id, …recipe as recipes_save}` (saves into the
  requester's book with auto-linking and the image copy; status done),
  `recipes_import_fail {id, reason}` (Hebrew reason shown to the user).
- **Rules, one source**: the conversion rules live in
  `src/lib/recipes/import-rules.ts`; `recipes_save`'s description and the claim
  result both carry them. The agent's procedure is `agents/recipe-import/PROMPT.md`
  (in the repo, to improve over time).
- **Agent session**: the owner starts a cloud Claude Code session (default
  environment, the hatom connector) telling it to run PROMPT.md in an endless
  loop, with the topic in the start message. Each pass works the queue; between
  passes it long-polls the topic's JSON stream with curl (≤ 9½ min, then a pass
  anyway), so a request is picked up within seconds and a missed wake-up only
  waits for the next pass. It reads PROMPT.md from its checkout; a changed
  prompt takes effect when the session is restarted.
