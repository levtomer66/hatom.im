# Shopping without cities — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the user-facing city in `/shopping` (page, REST routes, MCP tools) with a near set: stores within a radius of the live location or the household's home spot, plus ★ favorites, plus online stores.

**Architecture:** A new import-free `near.ts` holds the rules (parse a centre and radius, pick the near set). The read model loads every candidate store in one `find`; the service and routes take a `Near` (`{ where, favs }`) instead of a city string, resolved once per request by `nearFor(email, given)`. The page sends `lat`/`lng`/`r` on every pricing request.

**Tech Stack:** Next.js 15 App Router, TypeScript, MongoDB driver, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-18-shopping-no-cities-design.md`

## Global Constraints

- Radii: `RADII_KM = [1, 2, 5, 10]`, default `1`; localStorage key `shopping:radius`.
- Centres are rounded to 4 decimals; `lat` −90..90, `lng` −180..180, both or neither.
- `here/stores` lists physical stores within **10 km** of the centre, plus ★.
- The page re-runs the compare on a location change only when it moved > **150 m**.
- Location (`lat`/`lng`) is never stored, except the home spot a member saves.
- No ingest change: `CITIES`, `cityOf`, `StoreDoc.city`, `far`, `walkMin` stay as written. The app ignores `far`.
- `src/lib/shopping/*.ts` touched here stay import-free (tests import them by relative `.ts` path).
- Never read `.env*`; use `/opt/homebrew/bin` first on PATH; commits need the sandbox off (the pre-commit build fetches Google Fonts). Build with `MONGODB_URI=mongodb://127.0.0.1:27018/hatom-shopping-test`.
- Dev server on its own port (not :3200, not in `shopping-ui-2812ad`).

## Review Focus

1. **An old client still sending `city` and no `lat`/`lng`** (cached PWA, a Shortcut) → no 400; home spot or favorites are used. Pinned in Task 1 (`parseCentre(undefined, undefined)` → null) and Task 4 (routes ignore `city`).
2. **Only one of `lat`/`lng`, or a non-number** → 400, not a silent world-wide or empty set. Task 1 tests.
3. **A ★ store far away or with no `loc`** → still in the plans, `distM` from the centre (or null). Task 1 tests.
4. **No centre at all** (GPS denied, no home spot) → favorites + online, `where.source = 'none'`, page shows the "שמירת בית" prompt. Task 1 test + Task 6 browser check.
5. **"אני בסופר" at a store whose own radius holds nothing else** → the verdict compares with the store itself (and ★), never 404. Task 4 (here route keeps the picked store in its set).

---

### Task 1: `near.ts` — the near-set rules

**Files:**
- Create: `src/lib/shopping/near.ts`
- Modify: `src/lib/shopping/places.ts` (move `distanceM` to near.ts; places.ts does `import { distanceM } from './near.ts'` and `export { distanceM }`, like the siblings' `./x.ts` imports)
- Test: `src/lib/__tests__/shopping-near.test.ts`

**Interfaces:**
- Produces:
  - `RADII_KM: readonly number[]`, `DEFAULT_RADIUS_KM = 1`, `PICKER_RADIUS_KM = 10`
  - `type Centre = { lat: number; lng: number }`
  - `type WhereSource = 'live' | 'home' | 'none'`
  - `type Where = { centre: Centre | null; source: WhereSource; radiusKm: number }`
  - `parseCentre(lat: unknown, lng: unknown): Centre | null | string` — accepts numbers or numeric strings; null when both are absent (`undefined`, `null` or `''`); a string is the error.
  - `parseRadius(raw: unknown): number`
  - `resolveWhere(live: Centre | null, home: Centre | null, radiusKm: number): Where`
  - `nearStores<S extends { k: number; kind: 'physical' | 'online'; loc: Centre | null }>(stores: S[], where: Where, favs: number[]): (S & { distM: number | null })[]`
  - `distanceM(a: Centre, b: Centre): number` (moved from places.ts)

- [ ] **Step 1: Write the failing tests** in `shopping-near.test.ts`:

```ts
test('parseCentre: both, neither, one, junk', () => {
  assert.deepEqual(parseCentre(32.0853123, '34.7818456'), { lat: 32.0853, lng: 34.7818 });
  assert.equal(parseCentre(undefined, undefined), null);
  assert.equal(parseCentre('', null), null);
  assert.equal(typeof parseCentre(32, undefined), 'string');
  assert.equal(typeof parseCentre('abc', 34), 'string');
  assert.equal(typeof parseCentre(91, 34), 'string');
  assert.equal(typeof parseCentre(32, 181), 'string');
});
test('parseRadius: one of 1/2/5/10, else 1', () => {
  assert.equal(parseRadius('5'), 5); assert.equal(parseRadius(10), 10);
  assert.equal(parseRadius('3'), 1); assert.equal(parseRadius(undefined), 1);
});
test('resolveWhere: live, else home, else none', () => {
  const a = { lat: 32, lng: 34.7 }, b = { lat: 31.25, lng: 34.79 };
  assert.deepEqual(resolveWhere(a, b, 2), { centre: a, source: 'live', radiusKm: 2 });
  assert.deepEqual(resolveWhere(null, b, 1), { centre: b, source: 'home', radiusKm: 1 });
  assert.deepEqual(resolveWhere(null, null, 5), { centre: null, source: 'none', radiusKm: 5 });
});
test('nearStores: radius, favorites, no point, online', () => {
  const c = { lat: 32.08, lng: 34.78 };
  const at = (dLatM: number) => ({ lat: c.lat + dLatM / 111_195, lng: c.lng });
  const s = (k: number, loc: Centre | null, kind: 'physical' | 'online' = 'physical') => ({ k, kind, loc });
  const stores = [s(1, at(900)), s(2, at(1100)), s(3, at(50_000)), s(4, null), s(5, null), s(6, null, 'online')];
  const where = { centre: c, source: 'live' as const, radiusKm: 1 };
  const got = nearStores(stores, where, [3, 5]);
  assert.deepEqual(got.map((x) => x.k), [1, 3, 5, 6]);           // 2 outside, 4 unplaced and not ★
  assert.ok(Math.abs(got[0].distM! - 900) < 5);
  assert.ok(got[1].distM! > 49_000);                                // ★ far away keeps its distance
  assert.equal(got[2].distM, null); assert.equal(got[3].distM, null);
  assert.deepEqual(nearStores(stores, { ...where, radiusKm: 2 }, []).map((x) => x.k), [1, 2, 6]);
});
test('nearStores: no centre → favorites and online only', () => {
  const stores = [{ k: 1, kind: 'physical' as const, loc: { lat: 32, lng: 34 } }, { k: 2, kind: 'online' as const, loc: null }];
  assert.deepEqual(nearStores(stores, { centre: null, source: 'none', radiusKm: 1 }, []).map((x) => x.k), [2]);
  assert.deepEqual(nearStores(stores, { centre: null, source: 'none', radiusKm: 1 }, [1]).map((x) => x.k), [1, 2]);
});
```

- [ ] **Step 2: Run** `PATH=/opt/homebrew/bin:$PATH node --test src/lib/__tests__/shopping-near.test.ts` — expected FAIL (module not found).
- [ ] **Step 3: Implement `near.ts`** per the Interfaces block; keep input order in `nearStores`. Move `distanceM` and keep `places.ts` exporting it.
- [ ] **Step 4: Run** `npm test` — expected all pass (incl. `shopping-places.test.ts`).
- [ ] **Step 5: Commit** `feat(shopping): near-set rules (radius, favorites, home spot)`.

### Task 2: Home spot on the household; settings lose `city`

**Files:**
- Modify: `src/lib/shopping/home.ts` (`ShoppingHome` gains `homeSpot: Centre | null`; add `parseHomeSpot`)
- Modify: `src/models/ShoppingHome.ts` (`HomeDocument.homeSpot?`, read as `?? null`, new households `homeSpot: null`, `setHome` accepts `homeSpot`)
- Modify: `src/app/api/shopping/home/route.ts` (PATCH `{ homeSpot }`; "nothing to update" includes it)
- Modify: `src/lib/shopping/api-types.ts` (`ShoppingSettings` drops `city`), `src/models/ShoppingUserSettings.ts`, `src/app/api/shopping/settings/route.ts` (drop `city`, `CITIES` import; a `city` key is ignored)
- Test: `src/lib/__tests__/shopping-home.test.ts`

**Interfaces:**
- Consumes: `parseCentre`, `Centre` (Task 1).
- Produces: `parseHomeSpot(v: unknown): { ok: true; value: Centre | null } | { ok: false; error: string }` — `null` clears; `{lat,lng}` via `parseCentre` (a missing pair is an error here, text `'מיקום לא תקין'`). `Household.homeSpot: Centre | null`. `setHome(id, { homeSpot })`.

- [ ] **Step 1: Failing test**: `parseHomeSpot(null)` → `{ok:true,value:null}`; `parseHomeSpot({lat:32.08531,lng:34.78184})` → value `{lat:32.0853,lng:34.7818}`; `parseHomeSpot({lat:32})`, `parseHomeSpot('x')`, `parseHomeSpot({})` → `ok:false`.
- [ ] **Step 2: Run** the test → FAIL.
- [ ] **Step 3: Implement** the home.ts parser, the model field, PATCH handling and the settings cleanup.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit --incremental false --pretty false` — tsc will now flag every `settings.city` reader (`mcp-tools.ts`, `page.tsx`); leave those for Tasks 5–6 but note them. Expected: tests pass.
- [ ] **Step 5: No commit yet** (tsc isn't clean until Task 6; it lands in Task 6's commit).

### Task 3: Read model, service and `nearFor`

**Files:**
- Modify: `src/models/ShoppingCatalog.ts` — replace `getStoresFor(city)` with `getCandidateStores()` (filter: `{ $or: [{ pricesAt: { $ne: null } }, { source: 'manual' }] }`) and add `getStoresNear(where, favs)`.
- Create: `src/lib/shopping/near-server.ts` — `nearFor(email: string, given: { lat?: unknown; lng?: unknown; r?: unknown }): Promise<Near | string>` (reads `householdFor(email)` once; string = 400 error from `parseCentre`).
- Modify: `src/lib/shopping/service.ts` — `searchProducts(q, near)`, `itemPrices(raw, near)`, `CompareRequest = { near: Near; lines; clubs; coupons }`; `parseBasketRequest` returns `{ lat, lng, r, lines, clubs, coupons }` raw for `nearFor`; delete the `far` filter in `compareBasket`; responses carry `where` instead of `city`.
- Modify: `src/lib/shopping/api-types.ts` — `StoreInfo`: drop `city`, add `distM: number | null`; `storeInfo(s: StoreDoc & { distM?: number | null })`; `CompareResponse`, `ItemResponse`, `HereResponse`: `city` → `where: Where`; doc comments say "near" not "city".
- Modify: `src/lib/shopping/trips.ts` (+ test fixture in `shopping-trips.test.ts`): `Trip.city` becomes optional and unread; `parseTripCreate` no longer requires or copies it.
- Modify: `src/lib/shopping/here.ts` (+ `shopping-here.test.ts`): `inStorePickable` keeps physical stores only (no city test); `storeMatches` keeps its `cityName` haystack field (search words only).

**Interfaces:**
- Consumes: Task 1 (`Where`, `resolveWhere`, `parseCentre`, `parseRadius`, `nearStores`), Task 2 (`Household.homeSpot`, `favStores`).
- Produces: `type Near = { where: Where; favs: number[] }` (exported from `near.ts`); `getStoresNear(where: Where, favs: number[]): Promise<(StoreDoc & { distM: number | null })[]>`; `nearFor` as above; the service signatures above.

- [ ] **Step 1: Update tests first**: in `shopping-trips.test.ts` remove `city` from the create fixture and assert `parseTripCreate` accepts it without `city` and the result has no `city`; in `shopping-here.test.ts` change the `inStorePickable` test so a physical store with `city: null` is pickable and an online one is not.
- [ ] **Step 2: Run** `npm test` → those two FAIL.
- [ ] **Step 3: Implement** the files above. `nearStores` already keeps online stores, so the service splits by `kind` as today.
- [ ] **Step 4: Run** `npm test` → pass. tsc errors remain only in routes / MCP / page.
- [ ] **Step 5: No commit yet** (lands in Task 6's commit).

### Task 4: Routes take `lat`/`lng`/`r`

**Files:** `src/app/api/shopping/{search,item,compare,here,here/stores,here/deals,stores,trips}/route.ts`

**Interfaces:**
- Consumes: `nearFor`, `getStoresNear`, `nearStores`, `PICKER_RADIUS_KM`, `parseRadius`, service signatures (Task 3).

- [ ] **Step 1: Implement**:
  - `search`, `item`: `nearFor(email, { lat, lng, r })` from query params; string → 400. No `city` check.
  - `compare`: same from the body; `city` ignored.
  - `here/stores`: `nearFor` with `r = PICKER_RADIUS_KM`; physical stores only; response `{ stores }` (drop `city`).
  - `here?store&r`: load the picked store (`getStoreByKey`, physical, else 404 — drop the `city === null` test); the set = `nearStores(await getCandidateStores(), { centre: storeLoc(picked), source: 'live', radiusKm: parseRadius(r) }, favs)` filtered to physical, plus the picked store if missing (no `loc`). Response `where` instead of `city`.
  - `here/deals`: drop the `city === null` test.
  - `stores`: drop the city name from the response (it isn't in `StoreInfo` any more); keep `cityName` for matching words; `HereStore` gets `distM: null` (the page computes distance on the device).
  - `trips`: comment only (`city` no longer sent).
- [ ] **Step 2: Run** `npx tsc --noEmit --incremental false --pretty false` → only MCP / page errors left.
- [ ] **Step 3: Smoke** with the dev server later (Task 6); no route unit tests (routes aren't import-free).
- [ ] **Step 4: No commit yet**: the pre-commit build needs a clean tree-wide type-check, so Tasks 2–6 land together in Task 6's commit (never `--no-verify`).

### Task 5: MCP tools

**Files:** `src/lib/shopping/mcp-tools.ts`

**Interfaces:**
- Consumes: `nearFor`, service signatures.
- Produces: tool input props `lat` (number), `lng` (number), `radius_km` (number, enum 1/2/5/10) on `shopping_search`, `shopping_product_prices`, `shopping_add_items` (where it resolves products), `shopping_compare`. `shopping_set_city`, `CITY_ALIASES`, `CITY_LIST`, `parseCity`, `cityFor` removed.

- [ ] **Step 1: Implement**: `nearArgs(args)` → `nearFor(caller.userEmail, { lat: args.lat, lng: args.lng, r: args.radius_km })`; error string → `throw new Error(…)`. An `areaLabel(where)` helper for the answers: `'within 1 km of home'`, `'within 2 km of the given point'`, `'favorites only — no home spot set (⚙ → משק הבית on the page)'`. Replace `near ${city}` / `${city}:` texts with it.
- [ ] **Step 2: Run** tsc → only page errors left.

### Task 6: The page

**Files:** `src/app/shopping/page.tsx`, `Here.tsx`, `Missing.tsx`, `Household.tsx`, `shopping.css`

**Interfaces:**
- Consumes: routes from Task 4; `RADII_KM`, `DEFAULT_RADIUS_KM`, `distanceM` from `near.ts`; `Household.homeSpot`, `PATCH home { homeSpot }`.

- [ ] **Step 1: page.tsx**: delete `CITY_CENTRES`, `nearestCity`, `NEAR_CITY_M`, `LS_CITY*`, `city`/`cityMode`/`pickingCity` state and the picker. Add state `live: Centre | null`, `loc` status (as today), `radius` (from `shopping:radius`). `readLocation()` on mount and on ↻; ignore a fix within 150 m of the current one. `nearParams()` → `URLSearchParams` with `lat`, `lng` (when live) and `r`. Replace every `&city=${city}` and the compare body's `city`. Compare re-runs on `[live, radius, clubs, coupons, list]`. The location line: "ליד המיקום שלך" / "ליד הבית" / "אין מיקום" + "שמירת בית" button (when live and no home spot... and when none) + ↻. Radius chips `1 · 2 · 5 · 10 ק״מ` above the plan cards, `role="radiogroup"`. `PlansView` / `ManualStores` `key` use `result.where.source + radiusKm` instead of `city`. Store rows show `distM` as "1.2 ק״מ" / "350 מ׳" where they showed a city (`cityOfStore` goes); `tripSnapshot` drops `city`. Empty near set: "אין חנויות בטווח — אפשר להרחיב" next to the chips.
- [ ] **Step 2: Here.tsx**: drop `city` prop and `CITIES`; `/here/stores?` + live params; remembered store keyed by store only; `/here?store=&r=`; `FindBar`, `Verdict` use the page's `nearParams` (passed as a `near: string` query-string prop). Store sublines show the address only.
- [ ] **Step 3: Missing.tsx / ProductSheet**: `city` prop → `near: string` (the query string).
- [ ] **Step 4: Household.tsx**: home-spot row in the משק הבית sheet: "שמירת המיקום הנוכחי כבית" (one `getCurrentPosition`, PATCH home), shown state "הבית נשמר · ליד ‹nearest priced store›" (nearest from the page's loaded favorites/compare stores if available, else just "הבית נשמר") with שינוי / מחיקה (`homeSpot: null`).
- [ ] **Step 5: shopping.css**: remove `.sh-loc-pick` city chip styles no longer used; add radius chips (reuse `.sh-chip`).
- [ ] **Step 6: Run** `npx tsc --noEmit --incremental false --pretty false`, `npm run lint`, `npm test` → clean.
- [ ] **Step 7: Commit** Tasks 2–6 (sandbox off for the hook): `feat(shopping): price by location and favorites instead of city`.

### Task 7: Docs, browser check, final verification

**Files:** `docs/shopping-api.md`, `CLAUDE.md` (Shopping section), notes file in the shared notes folder.

- [ ] **Step 1: Docs**: API table params (`lat`, `lng`, `r`), MCP table (`lat`/`lng`/`radius_km`, no `shopping_set_city`), drop the "Cities:" line; CLAUDE.md: "Plans and compare stay on the user's city" → the near set; `far` ignored by the app; `getStoresFor` → `getStoresNear`; `settings.city` gone, home spot on `shoppingHome`.
- [ ] **Step 2: Browser**: `npm run dev:local -- -p 3110` via `.claude/launch.json` + preview_start; check: compare with chips 1→10 km changes the store count; denied/absent location → "ליד הבית"/"אין מיקום"; save home spot in ⚙; אני בסופר picker + a verdict; product view; search price range. Read console + network for 4xx/5xx.
- [ ] **Step 3: Full verification**: `npm test`, tsc, lint, `MONGODB_URI=mongodb://127.0.0.1:27018/hatom-shopping-test npm run build`.
- [ ] **Step 4: Commit** docs (sandbox off). Leave a hand-over note `no-cities-notes.md` in the shared notes folder (what the ingest may later drop: `far`).
