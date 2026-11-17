# My items and one shopping list — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace named shopping lists with a household "My items" catalogue and one shopping list filled through "מה חסר?".

**Architecture:** One Mongo document (`shoppingHome`, `_id: 'home'`) holds `items` and `list`. Pure logic lives in import-free `src/lib/shopping/home.ts`; the model `src/models/ShoppingHome.ts` wraps Mongo; `/api/shopping/home` serves the page, in-store mode, trips and MCP. `ListLine` keeps today's `ShoppingListItem` shape so the comparison is untouched.

**Tech Stack:** Next.js 15 App Router, TypeScript, MongoDB driver, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-18-shopping-my-items-design.md`

## Global Constraints

- Work in `/Users/tomer.l/repos/hatom.im/.claude/worktrees/shopping-home` (branch `claude/shopping-home`). Never commit in `.claude/worktrees/shopping-ui-2812ad` (its `next build` hook breaks the :3200 demo).
- Run node as `/opt/homebrew/bin/node` (put `/opt/homebrew/bin` first on `PATH` for `npm`/`npx`).
- `src/lib/shopping/home.ts` is import-free (tests import it via `../shopping/home.ts`).
- Limits: My items ≤ 300 (`MAX_MY_ITEMS`), list ≤ 100 (`MAX_LIST_ITEMS`); quantities through `normalizeQty` (whole units; 0.05 kg when weighted), ≤ `MAX_QTY` (100).
- Every route: `requireFeatureCaller(request, 'shopping')`.
- Copy (Hebrew, verbatim): "המוצרים שלי", "מה חסר?", "הוסף לרשימה (N)", "+ למוצרים שלי", "במוצרים שלי ✓", "נקה רשימה", "אחר", "לא נשמר, נסו שוב".
- Leave `shoppingLists` data untouched; nothing reads or writes it after Task 6 except the one-time migration.
- Local testing: `npm run dev:local -- -p 3300` (Docker Mongo on :27018, owner sign-in). Not :3200.
- Commit after each task; the pre-commit hook runs `npm test` + `next build` (on a WasmHash / next-font error: `rm -rf .next` and retry).

## Review Focus

1. **First load with no `home` doc while two tabs open** — exactly one doc; both see the same migrated items. (Task 2: upsert test via two parallel GETs.)
2. **"מה חסר?" picks an item already on the list** — the list keeps its edited quantity, no duplicate line. (Task 1: `addToList` test.)
3. **Trip ends with an item both ticked and marked not-there** — it stays on the list. (Task 1: `removeBought` test.)
4. **The list is edited during a trip, then the trip ends** — only ticked keys are pulled; lines added mid-trip survive. (Task 3: end uses `$pull` by key, test via route on dev server.)
5. **A removed My item that's still on the list** — the list line stays and still compares. (Task 5 run-through step.)

---

### Task 1: Pure home logic

**Files:**
- Create: `src/lib/shopping/home.ts`
- Test: `src/lib/__tests__/shopping-home.test.ts`

**Interfaces:**
- Consumes: nothing (import-free; copy `normalizeQty`, `MAX_QTY`, `MAX_LIST_ITEMS`, the key regex from `lists.ts` — Task 6 makes `lists.ts` re-export them from here).
- Produces:
  - `interface ListLine { key: string; name: string; w: boolean; qty: number }`
  - `interface MyItem extends ListLine { addedBy: string; addedAt: string }`
  - `interface ShoppingHome { items: MyItem[]; list: ListLine[]; updatedAt: string }`
  - `const MAX_MY_ITEMS = 300`, `MAX_LIST_ITEMS = 100`, `MAX_QTY = 100`, `normalizeQty(qty, w): number | null`
  - `parseList(v: unknown): Result<ListLine[]>` — today's `parseItems` (duplicates merge by summing, capped at `MAX_QTY`), limit 100.
  - `parseMyItems(v: unknown, by: string, now: string, prev: MyItem[]): Result<MyItem[]>` — same line rules, limit 300, duplicates keep the first; `addedBy`/`addedAt` kept from `prev` for keys already there, else `by`/`now`.
  - `parsePicks(v: unknown): Result<{ key: string; qty: number }[]>` — body `{ add }` of the "מה חסר?" submit; ≤ 100.
  - `pickMissing(items: MyItem[], picks: {key, qty}[]): ListLine[]` — unknown keys dropped; qty through `normalizeQty` with the item's `w`, falling back to the item's usual qty.
  - `addToList(list: ListLine[], lines: ListLine[]): ListLine[]` — existing keys unchanged, new appended, result capped at 100.
  - `removeBought(list: ListLine[], ticked: string[], notThere: string[]): ListLine[]`
  - `homeFromLists(lists: { items: ListLine[]; createdBy: string; updatedAt: string }[]): MyItem[]`

- [ ] **Step 1: Write failing tests** in `shopping-home.test.ts`:
  - `parseList merges duplicates and rejects 101 lines` — `[{key:'7290000000001',name:'חלב',qty:1,w:false}×2]` → one line qty 2; 101 distinct → `ok:false`, error contains `100`.
  - `parseMyItems keeps addedBy of existing items` — prev `[{key:'1',…,addedBy:'a@x',addedAt:'2026-01-01'}]`, input same key + key `'2'`, by `'b@x'` → key 1 `addedBy 'a@x'`, key 2 `addedBy 'b@x'`; 301 items → `ok:false`.
  - `parseMyItems rejects a bad key and a zero qty` — key `'abc'` → `ok:false`; qty 0 → `ok:false`.
  - `pickMissing uses the given qty, falls back to usual, drops unknown keys` — items `[{key:'1',qty:2,w:false},{key:'2',qty:0.5,w:true}]`, picks `[{key:'1',qty:3},{key:'2',qty:NaN},{key:'9',qty:1}]` → `[{key:'1',qty:3},{key:'2',qty:0.5}]`.
  - `addToList keeps an edited quantity and appends new keys` — list `[{key:'1',qty:5}]` + `[{key:'1',qty:2},{key:'2',qty:1}]` → `[{key:'1',qty:5},{key:'2',qty:1}]`.
  - `removeBought drops ticked unless not there` — list keys 1,2,3; ticked `['1','2']`, notThere `['2']` → keys `['2','3']`.
  - `homeFromLists dedupes, keeps max qty and the latest name` — two lists (older has key 1 qty 3 name 'ישן', newer has key 1 qty 1 name 'חדש', createdBy 'n@x') → one item qty 3, name 'חדש', addedBy 'n@x'.

- [ ] **Step 2: Run** `npm test -- --test-name-pattern=home` → FAIL (module not found).
- [ ] **Step 3: Implement** the Produces list in `home.ts`.
- [ ] **Step 4: Run** `npm test` → all pass.
- [ ] **Step 5: Commit** `feat(shopping): pure logic for My items and the single list`.

### Task 2: Model and `/api/shopping/home` routes

**Files:**
- Create: `src/models/ShoppingHome.ts`, `src/app/api/shopping/home/route.ts`, `src/app/api/shopping/home/list/route.ts`

**Interfaces:**
- Consumes: Task 1 types and parsers; `getAllShoppingListsForMigration()` — add to `src/models/ShoppingList.ts`: every doc, `{ items, createdBy, updatedAt }` (no visibility filter; household).
- Produces (model):
  - `getHome(): Promise<ShoppingHome>` — `findOne({_id:'home'})`; when missing, `updateOne({_id:'home'}, {$setOnInsert:{items: homeFromLists(...), list: [], updatedAt}}, {upsert:true})` then re-read.
  - `setMyItems(items: MyItem[]): Promise<ShoppingHome>`, `setList(list: ListLine[]): Promise<ShoppingHome>` — `$set` + `updatedAt`, return after.
  - `addLines(lines: ListLine[]): Promise<ShoppingHome>` — read, `addToList`, `$set list`.
  - `ensureMyItems(lines: ListLine[], by: string): Promise<void>` — append lines whose key isn't in `items` (qty = the line qty), respecting 300.
  - `pullBought(ticked: string[], notThere: string[]): Promise<void>` — `$pull: { list: { key: { $in: ticked minus notThere } } }`.
- Produces (HTTP):
  - `GET /api/shopping/home` → `ShoppingHome & { dept: Record<string, string>; img: Record<string, string> }` — department id and photo per My item key, from `getItems(keys)` in `src/models/ShoppingCatalog.ts` (`d`, `img`); keys without one are left out. PATCH/POST responses carry the same two maps.
  - `PATCH /api/shopping/home` body `{ items?, list? }` → `ShoppingHome`; neither → 400 `nothing to update`; parser errors → 400 with the message.
  - `POST /api/shopping/home/list` body `{ add }` → `ShoppingHome` (via `pickMissing` against current items, then `addLines`).

- [ ] **Step 1:** Implement the model and routes (pattern: `src/app/api/shopping/lists/route.ts` for auth, JSON errors, 500 logging).
- [ ] **Step 2: Verify on a dev server.** Start `npm run dev:local -- -p 3300`; in the Docker DB first `db.shoppingHome.deleteMany({})`. Then:
  - two parallel `GET /api/shopping/home` → same `items` length, `db.shoppingHome.countDocuments()` = 1, items = distinct keys across `shoppingLists`.
  - `PATCH {list:[{key:<a My item key>,name:'x',qty:2,w:false}]}` → list has it; `POST /home/list {add:[{key:<same>,qty:9},{key:<another>,qty:1}]}` → first keeps qty 2, second appended.
  - `PATCH {}` → 400.
- [ ] **Step 3: Commit** `feat(shopping): shoppingHome model and /api/shopping/home`.

### Task 3: Trips and in-store mode on the single list

**Files:**
- Modify: `src/app/api/shopping/trips/[id]/route.ts` (end branch), `src/app/api/shopping/here/route.ts`, `src/lib/shopping/api-types.ts` (here response: drop `lists`; rows keep `listIds` = `['home']`), `src/app/shopping/Here.tsx` (remove the lists nav at ~293–300 and `listsWithItems`; its "+ לרשימה" calls `POST /api/shopping/home/list` after `PATCH` adding to My items when new — use one helper `addToHomeList(key, name, w, qty)` in `src/app/shopping/home-client.ts`, created here, which Task 5 reuses).
- Test: `src/lib/__tests__/shopping-here.test.ts` (adjust `mergeLists` callers only if signature changes — it doesn't).

**Interfaces:**
- Consumes: `getHome`, `pullBought`, `addLines`, `ensureMyItems`.
- Produces: `home-client.ts`: `api<T>(path, init?)` (moved from page.tsx), `addToHomeList(line: ListLine): Promise<ShoppingHome>`, `saveMyItems(items: MyItem[])`, `saveList(list: ListLine[])`, `submitMissing(add: {key, qty}[])`.

- [ ] **Step 1:** On trip end (`'end' in p`), after `endTrip(id)` returns the trip, `await pullBought(trip.ticked, trip.notThere)` (`notThere` is `string[]`).
- [ ] **Step 2:** Here route: `const home = await getHome(); const lines = mergeLists([{ id: 'home', items: home.list }]); getRecentTicked(['home'])`.
- [ ] **Step 3:** New trips: wherever the page builds `TripCreate` (`tripSnapshot(..., listId, ...)` in page.tsx) pass `'home'` (Task 5 removes the list id variable; here just accept that the call site changes in Task 5).
- [ ] **Step 4: Verify** on :3300: start a trip from the page (after Task 5) — for now via `POST /api/shopping/trips` with a minimal valid body for `listId:'home'`, tick one key, set one key not-there, end → `GET /home` list lacks the ticked key, keeps the not-there key and a line PATCHed in mid-trip.
- [ ] **Step 5:** `npm test`, `npx tsc --noEmit` pass (page.tsx may still use lists — it compiles because the old model still exists until Task 6). Commit `feat(shopping): trips and in-store mode use the single list`.

### Task 4: MCP tools

**Files:**
- Modify: `src/lib/shopping/mcp-tools.ts`, `docs/shopping-api.md`

**Interfaces:**
- Consumes: `getHome`, `setList`, `addLines`, `ensureMyItems`.
- Produces tools: `shopping_my_items` (no args; lines "name · qty"), `shopping_get_list` (no args), `shopping_add_items` (same args as today minus list selection; also `ensureMyItems`), `shopping_remove_items` (no list arg), `shopping_compare` (compares `home.list`). Remove `shopping_lists`, `shopping_create_list`, `listFor`.

- [ ] **Step 1:** Update the tools; keep each tool's existing permission re-check.
- [ ] **Step 2: Verify:** `curl` `tools/list` on `/api/mcp` with a local `htm_` key (or `dev:local` session) shows the five tools; `tools/call shopping_add_items` with a product adds it to the list and to My items.
- [ ] **Step 3:** Update `docs/shopping-api.md` tool table. Commit `feat(shopping): MCP tools for My items and the single list`.

### Task 5: Page — My items, "מה חסר?", the list

**Files:**
- Create: `src/app/shopping/MyItems.tsx` (the "המוצרים שלי · N" collapsible section), `src/app/shopping/Missing.tsx` (the sheet)
- Modify: `src/app/shopping/page.tsx` (remove list state/chips/editing/sharing at ~151–470 and ~540–680, the `LS_LIST`/`LS_LISTS_CACHE` keys; add `home` state from `GET /home`, cached in `shopping:home-cache`), `src/app/shopping/shopping.css`

**Interfaces:**
- Consumes: `home-client.ts` (Task 3); `ProductSheet`'s `inList`/`onAdd` props become `saved`/`onSave` → `saveMyItems([...items, newItem])`.
- Produces:
  - `MyItems({ items, onChange }: { items: MyItem[]; onChange: (items: MyItem[]) => void })` — rows: photo, name, usual-qty stepper (existing qty control), remove.
  - `Missing({ items, list, city, onClose, onAdded }: { items: MyItem[]; list: ListLine[]; city: string; onClose(): void; onAdded(home: ShoppingHome): void })` — groups by department using `home.dept` (Task 2) and the `DEPARTMENTS` labels in `src/lib/shopping/departments.ts`; keys with no department under "אחר", on-list rows ticked + disabled, search at top reusing the page's search component (picking adds to My items and ticks), submit "הוסף לרשימה (N)".

- [ ] **Step 1:** Extract `api` usage to `home-client.ts`; load `home` on mount; comparison request body uses `home.list`; `tripSnapshot(result, plan, 'home', city)`.
- [ ] **Step 2:** Build `MyItems` and `Missing`; list section: lines with qty stepper + remove → `saveList`, "נקה רשימה" behind `confirm()`; empty list → empty state with "מה חסר?" instead of results.
- [ ] **Step 3: Verify in the browser** on :3300 (Chrome, not Playwright — HMR loop): empty state → search, "+ למוצרים שלי" → item in My items, product window shows "במוצרים שלי ✓" → "מה חסר?" shows it under its department with its usual qty → add 2 items → comparison and plans render → remove one My item still on the list → list line stays and compares → "אני בסופר": tick one, mark one not there, end → ticked gone, not-there stays. Check RTL and 375 px width.
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run lint`, `npm test`. Commit `feat(shopping): My items and "מה חסר?" replace named lists`.

### Task 6: Remove named lists; docs

**Files:**
- Delete: `src/app/api/shopping/lists/route.ts`, `src/app/api/shopping/lists/[id]/route.ts`
- Modify: `src/models/ShoppingList.ts` (keep only `getAllShoppingListsForMigration`), `src/lib/shopping/lists.ts` (keep `searchTerms`; re-export `normalizeQty`, `MAX_QTY`, `MAX_LIST_ITEMS`, `ListLine as ShoppingListItem` from `home.ts`; drop list/patch/sharing), `src/lib/__tests__/shopping-lists.test.ts` (keep `normalizeQty`/`searchTerms` tests; drop create/patch/sharing), `src/app/api/shopping/compare/route.ts` import if needed, `CLAUDE.md` (shopping UI note: "Lists are shared by everyone holding `shopping`" → My items + single list in `shoppingHome`).

- [ ] **Step 1:** Delete and trim; `grep -rn "ShoppingList\b\|parseListPatch\|/shopping/lists" src` → no hits except the migration reader.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build` pass.
- [ ] **Step 3:** Commit `refactor(shopping): drop named lists`.
