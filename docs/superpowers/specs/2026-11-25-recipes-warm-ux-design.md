# /recipes — warm look, start sheet, prompt to table

Date: 2026-11-25. Builds on `2026-11-24-recipes-design.md` (data, routes, import
agent). The owner showed Potluck (a recipe organiser app) as the experience to
aim for: **keep the experience, not the app** — no copied art, names or copy.

## What the owner asked for

- A start sheet behind +, a prompt-to-recipe card, the bottom tab bar and the look.
- Not menus/collections.
- /recipes gets its own warm look (replaces "wear the calories look"), while the
  calories building blocks stay underneath.
- Tabs: שלי · פיד · רשימה.

## 1. Look (scoped to /recipes)

- Tokens on `.rc-app` in `recipes.css`: warm dark plum surfaces (bg, raised,
  field), a coral accent (buttons, active tab, links), cream text, muted
  lavender-grey secondary text. Light scheme: cream bg, plum text, same coral.
  Contrast ≥ 4.5:1 for body text.
- Display font: **Frank Ruhl Libre** (Hebrew + Latin) through `next/font/google`
  in `src/app/recipes/layout.tsx` — self-hosted at build, so the CSP is
  unchanged. Used for page titles, the start sheet's heading and card titles,
  and recipe names on the recipe page. Body text keeps the site font.
- Rounded, roomy controls: fields and cards ≈ 20 px radius, 52 px+ tap targets.
- **Illustrations**: our own line-art SVGs, inline React components in
  `src/app/recipes/art.tsx`, drawn in `currentColor` + one accent, no files:
  `PotArt` (pot with steam and a spoon — empty book), `CauldronArt` (pot with
  sparkles — start sheet), `UtensilsPattern` (scattered utensils, tiled — the
  cover band with no photo). Decorative (`aria-hidden`).
- Calories' `Sheet`, rows, `useAutosave`, toasts and `FoodPicker` stay; they
  take the tokens where they read CSS variables, and get recipe-scoped
  overrides otherwise.

## 2. Book (`/recipes`)

- Header: the big serif title "מתכונים", + as a coral rounded-square button
  (opens the start sheet), search field right under the title.
- Import requests (ImportsList) stay at the top, restyled as cards.
- Recipe rows: photo (or the initial on a tinted square), name, the new short
  description when there is one (one line, ellipsis), else time/tags; kcal at the end.
- Tag chips stay above the list.
- Empty states (illustration + line + coral button):
  - שלי with no recipes: `PotArt`, "הוסיפו את המתכון הראשון", button "הוספת מתכון"
    → start sheet.
  - פיד with nothing shared: `PotArt`, "עוד אין מתכונים בפיד".
  - Search/tag with no hits: text only, "לא נמצאו מתכונים".
- **Bottom tab bar**: a floating pill (fixed, centred, safe-area aware), three
  icon + label tabs: שלי · פיד · רשימה. שלי/פיד switch the book's view (the
  current top pill tabs go away; the view stays in the URL `?view=feed` so back
  works). רשימה is a link to the shopping page (`SHOPPING_BASE_PATH`), shown only
  with the `shopping` permission. The bar shows on the book only — not on a
  recipe, in edit or in cooking mode. The page gets bottom padding so the last
  row isn't under it.

## 3. Start sheet (+)

A sheet: `CauldronArt`, the heading "איך מתחילים?", the line "בחרו את הדרך
המהירה להכניס מתכון", and four large cards (icon in a tinted circle, serif
title, one-line description):

1. **מרעיון למתכון** — "כתבו רעיון ונכתוב מתכון מלא". Opens a step in the same
   sheet: one textarea (placeholder "שקשוקה מהירה לשניים עם פטה"), optional note,
   "יאללה". Queues an import request with `prompt`.
2. **הדבקת טקסט** — "הדביקו מתכון ונסדר אותו". The text step (today's text field + note).
3. **קישור** — "אינסטגרם, טיקטוק, יוטיוב או אתר מתכונים". The link step (URL + note).
4. **מאפס** — "טופס ריק, ממלאים לבד". Creates an empty recipe (as + does today)
   and opens its editor.

Each step has a back arrow to the cards. Cards 1–3 close the sheet on success
and the request shows at the top of the book ("ממתין…"), as today. The old
separate ייבוא button goes away; `ImportSheet` becomes the start sheet.

## 4. Prompt to table

- `ImportRequest` gains `prompt: string` ('' when absent). `parseImportRequest`
  accepts `{prompt, note}` as a third kind: a request needs a url, text or a
  prompt; prompt ≤ 500 chars; a prompt request carries no url/text. Errors in Hebrew.
- The claim result returns `prompt` too. `recipes_import_queue/claim` unchanged
  otherwise; the card in ImportsList shows the prompt as its subtitle.
- `import-rules.ts` gains the rules for writing from an idea: a real, cookable
  recipe in Hebrew; ingredients easy to buy in Israel; metric and Israeli
  measures; 2–4 servings unless asked; honest times; no `source_url`; tags as
  for imports.
- `PROMPT.md` step 2.2 gains the branch: a request with a prompt is written from
  the idea (no fetching), then completed like an import. A prompt asking for
  something that isn't a recipe → fail with a Hebrew reason.

## 5. Create and edit (cover first)

- The editor opens with a **cover band** (≈ 200 px): the photo, or
  `UtensilsPattern` on the raised surface with a centred camera chip "הוספת
  תמונה". Tapping it picks a photo (existing photo upload).
- Under it, overlapping the band's bottom edge: the title as a big rounded field
  (placeholder "שם המתכון"), then **description** (new, placeholder "תיאור קצר",
  ≤ 200 chars, one or two lines), then the link field ("קישור", the existing
  `source.url`, https only, with a link icon).
- Then, as today on the same page: servings and times, tags, ingredients,
  steps, notes, sharing. Autosave unchanged (description joins the head group).
  No step wizard.
- `description` is a `Recipe` field (`''` default), in `LIMITS` (200), in
  `parseRecipePatch`, `RecipeSummary`, `recipes_save`/`recipes_get` and the share
  text (under the name). The recipe page shows it under the name.

## 6. Recipe page

- Same cover band on top (photo or pattern), the name in the serif font, the
  description, then today's content in the new tokens. Cooking mode keeps its
  own high-contrast look.

## Unchanged

Data beyond `description` and `prompt`; the feed, copy, 🛒, logging to calories,
cooking mode behaviour, MCP tools other than the prompt field, the cloud agent's
loop.

## Testing

- `node --test`: `parseImportRequest` with a prompt (ok, too long, prompt +
  url rejected, empty rejected); `parseRecipePatch` description (trimmed, > 200
  rejected); `emptyRecipe().description === ''`; `shareText` includes the description.
- Browser at 375 px, both schemes, RTL: empty book → + → each card's step →
  queued card at the top; מאפס → editor with the cover band → title,
  description, link autosave and survive a reload; tab bar switches שלי/פיד
  (back button returns), רשימה opens shopping; the bar is absent on a recipe.
