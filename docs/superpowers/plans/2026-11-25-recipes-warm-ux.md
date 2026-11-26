# /recipes warm UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give /recipes its own warm look, a start sheet behind + (idea / text / link / scratch), prompt-to-table imports, a cover-first editor with a short description, and a bottom tab bar.

**Architecture:** Two data additions (`Recipe.description`, `ImportRequest.prompt`) go through the existing pure parsers and models; everything else is client UI in `src/app/recipes/` on CSS tokens scoped to `.rc-app`. The cloud import agent learns the prompt branch from `PROMPT.md` + `import-rules.ts`.

**Tech Stack:** Next.js 15 App Router, React, plain CSS, `next/font/google`, Mongo native driver, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-recipes-warm-ux-design.md` (builds on `2026-11-24-recipes-design.md`).

## Global Constraints

- Node by absolute path: `/opt/homebrew/bin/node`; tests: `npm test`; build needs `MONGODB_URI=mongodb://127.0.0.1:27018/hatom-shopping-test`.
- `src/lib/recipes/*.ts` touched here stay import-free (relative `.ts` imports only) except the files CLAUDE.md lists.
- Limits: description ≤ 200 chars; prompt ≤ 500 chars; link https only.
- Look is scoped to `.rc-app` (the /recipes layout wrapper); no change to other pages' CSS. No external origins (CSP unchanged): the font comes from `next/font/google`.
- Illustrations are our own inline SVG (`aria-hidden`), no image files, nothing traced from Potluck.
- Hebrew copy exactly as in the spec (headings, card titles, placeholders, empty states).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stop the preview server before a hooked commit (the hook's `next build` breaks a running dev server); UI-only commits may use `--no-verify` after `npx tsc --noEmit` and `npm run lint` pass.

## Review Focus

1. A prompt request with a url or text as well → rejected (spec: a prompt request carries neither), not silently merged. Test in Task 2.
2. Clearing the link field (empty string) → `source: null`, not `{url: ''}`; an `http:` link → error. Test in Task 1.
3. Back button after switching to פיד returns to שלי (view in the URL, `router.push` not `replace`). Checked in Task 4's browser step.
4. Last recipe row and the start sheet's last card are not hidden under the tab bar at 375 px with the iPhone safe area. Checked in Task 4/5 browser steps.
5. Old recipes and import docs without `description` / `prompt` read as `''` (no `undefined` in the UI or share text). Test in Tasks 1 and 2.

---

### Task 1: `description` and an editable link on recipes

**Files:**
- Modify: `src/lib/recipes/types.ts` (`Recipe.description: string`, `RecipeSummary.description: string`, `LIMITS.description = 200`)
- Modify: `src/lib/recipes/recipe.ts` (`RecipePatch` gains `description` and `source`; `parseRecipePatch`; `emptyRecipe`; `parseSaveArgs` accepts `description`)
- Modify: `src/lib/recipes/share.ts` (description line under the name)
- Modify: `src/models/Recipe.ts` (`toSummary` adds `description: r.description ?? ''`; `toRecipe` defaults `description` to `''`)
- Modify: `src/lib/recipes/mcp-tools.ts` (`RECIPE_PROPS.description`, `recipes_get` output shows it)
- Test: `src/lib/__tests__/recipes-recipe.test.ts`, `src/lib/__tests__/recipes-view.test.ts`

**Interfaces:**
- Produces: `RecipePatch.description?: string`, `RecipePatch.source?: { url: string; by: null } | null` (patch key on the wire: `sourceUrl: string`, `''` → `null`); `Recipe.description`; `RecipeSummary.description`.

- [ ] **Step 1: Write the failing tests**

```ts
test('description is trimmed and capped at 200', () => {
  assert.deepEqual(parseRecipePatch({ description: '  קליל  ' }), { ok: true, value: { description: 'קליל' } });
  assert.equal(parseRecipePatch({ description: 'א'.repeat(201) }).ok, false);
});
test('sourceUrl: https kept, empty clears, http rejected', () => {
  assert.deepEqual(parseRecipePatch({ sourceUrl: 'https://x.co/a' }), { ok: true, value: { source: { url: 'https://x.co/a', by: null } } });
  assert.deepEqual(parseRecipePatch({ sourceUrl: '' }), { ok: true, value: { source: null } });
  assert.equal(parseRecipePatch({ sourceUrl: 'http://x.co' }).ok, false);
});
test('emptyRecipe has an empty description', () => assert.equal(emptyRecipe().description, ''));
// recipes-view.test.ts
test('shareText puts the description under the name', () => {
  const t = shareText({ ...base, description: 'ארוחת ערב מהירה' }, base.servings);
  assert.match(t, /^\*.+\*\nארוחת ערב מהירה\n/);
});
test('shareText without a description has no blank line for it', () => {
  const { description: _, ...old } = { ...base, description: '' };
  assert.doesNotMatch(shareText(old as Recipe, base.servings), /^\*.+\*\n\n/);
});
```

- [ ] **Step 2: Run `npm test`** — Expected: the new tests FAIL (unknown keys dropped / `description` undefined).
- [ ] **Step 3: Implement** the fields above. `parseRecipePatch`: `description` must be a string ≤ 200 after trim (error 'תיאור ארוך מדי'); `sourceUrl` string: `''` → `source: null`, else `new URL` with `https:` and ≤ 2000 chars (error 'צריך קישור https'). `shareText` pushes `r.description?.trim()` right after the name when non-empty. `updateRecipe` already `$set`s patch keys, so `source` flows through.
- [ ] **Step 4: Run `npm test`** — Expected: all pass.
- [ ] **Step 5: Commit** `feat(recipes): short description and an editable link`.

### Task 2: Prompt-to-table import requests

**Files:**
- Modify: `src/lib/recipes/imports.ts` (`ImportRequest.prompt: string`; `parseImportRequest` returns `{url, text, prompt, note}`; header comment says "the cloud import agent")
- Modify: `src/models/RecipeImport.ts` (`createImport` takes `prompt`; reads default `prompt ?? ''`)
- Modify: `src/lib/recipes/mcp-tools.ts` (`recipes_import_claim` output adds `Idea to write: …` when `prompt`, and the idea rules)
- Modify: `src/lib/recipes/import-rules.ts` (export `IDEA_RULES: string`)
- Modify: `agents/recipe-import/PROMPT.md` (step 2.2 branch)
- Modify: `src/app/recipes/ImportsList.tsx` (subtitle = prompt when there is one)
- Test: `src/lib/__tests__/recipes-imports.test.ts`

**Interfaces:**
- Produces: `parseImportRequest(v) → Result<{ url: string | null; text: string; prompt: string; note: string }>`; `api.requestImport({url?, text?, prompt?, note?})` (Task 5 calls it).

- [ ] **Step 1: Write the failing tests**

```ts
test('a prompt alone is a request', () => {
  assert.deepEqual(parseImportRequest({ prompt: ' שקשוקה לשניים ' }), { ok: true, value: { url: null, text: '', prompt: 'שקשוקה לשניים', note: '' } });
});
test('a prompt over 500 chars is refused', () => assert.equal(parseImportRequest({ prompt: 'א'.repeat(501) }).ok, false));
test('a prompt with a url or text is refused', () => {
  assert.equal(parseImportRequest({ prompt: 'פסטה', url: 'https://x.co' }).ok, false);
  assert.equal(parseImportRequest({ prompt: 'פסטה', text: 'מתכון' }).ok, false);
});
test('nothing at all is refused', () => assert.equal(parseImportRequest({ note: 'x' }).ok, false));
test('link and text requests carry an empty prompt', () => {
  const r = parseImportRequest({ url: 'https://x.co/r' });
  assert.ok(r.ok && r.value.prompt === '');
});
```

- [ ] **Step 2: Run `npm test`** — Expected: FAIL.
- [ ] **Step 3: Implement.** Errors: 'הרעיון ארוך מדי', 'רעיון לבד, בלי קישור או טקסט', and the empty case becomes 'כתבו רעיון, הדביקו קישור או את טקסט המתכון'. `IDEA_RULES` (English, for the agent): a real, cookable recipe written in Hebrew; ingredients easy to buy in Israel; metric and Israeli measures (כוס, כף, כפית, גרם); 2–4 servings unless the idea says; honest prep/cook minutes; no `source_url`; tags as for imports; a request that isn't a dish → fail with a Hebrew reason. PROMPT.md 2.2: "When the claim has an idea, don't fetch anything: write the recipe from the idea by the idea rules in the claim, then complete it (step 4)."
- [ ] **Step 4: Run `npm test`** — Expected: pass. `npx tsc --noEmit --incremental false` clean.
- [ ] **Step 5: Commit** `feat(recipes): prompt-to-table import requests`.

### Task 3: Warm tokens, serif font, illustrations

**Files:**
- Modify: `src/app/recipes/layout.tsx` (load `Frank_Ruhl_Libre` from `next/font/google`, subsets `['hebrew','latin']`, weights `['500','700']`, `variable: '--rc-serif'`; wrap children in `<div className={`rc-app ${serif.variable}`}>`)
- Modify: `src/app/recipes/recipes.css` (tokens on `.rc-app` for dark (default) and `@media (prefers-color-scheme: light)`; `--rc-bg`, `--rc-raised`, `--rc-field`, `--rc-text`, `--rc-muted`, `--rc-accent`, `--rc-accent-ink`, `--rc-line`; `.rc-serif { font-family: var(--rc-serif), serif }`; remap the calories variables the reused classes read, inside `.rc-app`)
- Create: `src/app/recipes/art.tsx` (`PotArt`, `CauldronArt`, `UtensilsPattern`; each `({ className?: string }) => JSX`, SVG with `currentColor` strokes and `var(--rc-accent)` details, `aria-hidden`)

**Interfaces:**
- Produces: tokens and `.rc-serif`; `PotArt`, `CauldronArt`, `UtensilsPattern` (Tasks 4–6).

- [ ] **Step 1:** Implement. Dark values: bg `#231a22`, raised `#33272f`, field `#3f3139`, text `#f5ece4`, muted `#b3a3ad`, accent `#e5484d`, accent-ink `#fff`, line `#4a3a43`. Light: bg `#fbf6f1`, raised `#fff`, field `#f1e8e2`, text `#2a1e27`, muted `#6f5f69`, same accent, accent-ink `#fff`, line `#e6dad3`.
- [ ] **Step 2:** `npx tsc --noEmit --incremental false && npm run lint` — clean. Start preview `recipes-local`, open `/recipes` at 375 px in dark and light: page background and text use the tokens; no other page changed (open `/calories` once).
- [ ] **Step 3: Commit** `feat(recipes): warm look — tokens, serif headings, illustrations`.

### Task 4: Book — header, rows, empty states, tab bar

**Files:**
- Modify: `src/app/recipes/page.tsx` (view from `useSearchParams().get('view') === 'feed'`; switching uses `router.push('?view=feed')` / `router.push('/recipes')`; remove the pill tabs and the separate ייבוא button; + opens the start sheet (Task 5); empty states)
- Modify: `src/app/recipes/RecipeCard.tsx` (second line: description, else time · tags)
- Create: `src/app/recipes/TabBar.tsx` (`TabBar({ view: 'mine' | 'feed', onView(v), showList: boolean })`; three tabs שלי · פיד · רשימה; רשימה is a `<Link href={SHOPPING_BASE_PATH}>`; `nav` with `aria-label="ניווט מתכונים"`, active tab `aria-current="page"`)
- Modify: `src/app/recipes/recipes.css`

**Interfaces:**
- Consumes: Task 3 art + tokens; `hasPermission(session, 'shopping')` for `showList`.

- [ ] **Step 1:** Implement. Page wraps in `<Suspense>` for `useSearchParams`. Bottom padding on the book = tab bar height + `env(safe-area-inset-bottom)` + 16 px. Empty states exactly: שלי → `PotArt`, "הוסיפו את המתכון הראשון", button "הוספת מתכון" (opens the start sheet); פיד → `PotArt`, "עוד אין מתכונים בפיד"; no hits → "לא נמצאו מתכונים".
- [ ] **Step 2:** tsc + lint clean. Browser at 375 px: header (serif title, coral +, search), rows with descriptions, פיד via tab then browser back → שלי; רשימה goes to shopping; last row fully visible above the bar; the bar is absent on `/recipes/<id>`.
- [ ] **Step 3: Commit** `feat(recipes): book header, tab bar and empty states`.

### Task 5: Start sheet

**Files:**
- Create: `src/app/recipes/StartSheet.tsx` (replaces `ImportSheet.tsx`, which is deleted) — `StartSheet({ onClose, onQueued(req: ImportRequest), onScratch() })`; state `step: 'cards' | 'idea' | 'text' | 'link'`
- Modify: `src/app/recipes/page.tsx` (render it; `onScratch` = today's create-and-open)
- Modify: `src/app/recipes/api.ts` (`requestImport` body accepts `prompt`)
- Modify: `src/app/api/recipes/imports/route.ts` (passes `prompt` to `createImport`)
- Modify: `src/app/recipes/recipes.css`

**Interfaces:**
- Consumes: Task 2 `parseImportRequest` shape; Task 3 `CauldronArt`.

- [ ] **Step 1:** Implement with the spec's copy: heading "איך מתחילים?", line "בחרו את הדרך המהירה להכניס מתכון", cards (title / line): מרעיון למתכון / "כתבו רעיון ונכתוב מתכון מלא"; הדבקת טקסט / "הדביקו מתכון ונסדר אותו"; קישור / "אינסטגרם, טיקטוק, יוטיוב או אתר מתכונים"; מאפס / "טופס ריק, ממלאים לבד". Idea step: textarea placeholder "שקשוקה מהירה לשניים עם פטה", optional note, button "יאללה". Each step: back arrow (`aria-label="חזרה"`) to the cards; server errors shown under the button; success closes the sheet.
- [ ] **Step 2:** tsc + lint clean. Browser: each card's step, back, submit an idea → the queued card at the top shows the idea; מאפס opens a new recipe's editor; the last card is reachable above the safe area.
- [ ] **Step 3: Commit** `feat(recipes): start sheet with idea, text, link and scratch`.

### Task 6: Cover-first editor and recipe page

**Files:**
- Create: `src/app/recipes/CoverBand.tsx` (`CoverBand({ photo: string | null, busy?: boolean, onPick?: () => void })` — photo, else `UtensilsPattern` with the chip "הוספת תמונה" when `onPick`; ≈ 200 px)
- Modify: `src/app/recipes/RecipeEditor.tsx` (`Details` gains `description`, `sourceUrl`; `detailsPatch` sends both, holding back while `sourceUrl` is non-empty and not `https://…`; layout: CoverBand → title field (placeholder "שם המתכון") → description (placeholder "תיאור קצר", maxLength 200) → link field ("קישור", link icon) → rest unchanged)
- Modify: `src/app/recipes/RecipeView.tsx` (CoverBand without `onPick`, name in `.rc-serif`, description under it)
- Modify: `src/app/recipes/api.ts` (`patchRecipe` type adds `description`, `sourceUrl`)
- Modify: `src/app/api/recipes/[id]/route.ts` only if PATCH filters keys before `parseRecipePatch`
- Modify: `src/app/recipes/recipes.css`

**Interfaces:**
- Consumes: Task 1 patch keys; Task 3 art.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** tsc + lint clean. Browser: new recipe → type title, description, a link → reload → all kept; clear the link → reload → no source link on the recipe page; `http://` link shows the field invalid and isn't saved; recipe page shows the band, serif name and description; cooking mode unchanged.
- [ ] **Step 3: Commit** `feat(recipes): cover-first editor, description and link`.

### Task 7: Docs and full check

**Files:**
- Modify: `CLAUDE.md` (Recipes section: the warm look is recipes' own (`.rc-app` tokens, `art.tsx`), the start sheet, `prompt` requests, `description`)
- Modify: `docs/superpowers/specs/2026-11-24-recipes-design.md` (one line pointing to the 2026-11-25 spec for the UI)

- [ ] **Step 1:** Write the notes.
- [ ] **Step 2:** Stop the preview; `npm test` all pass; `MONGODB_URI=mongodb://127.0.0.1:27018/hatom-shopping-test npm run build` green.
- [ ] **Step 3: Commit** (hooked) `docs(recipes): warm UX notes`.
