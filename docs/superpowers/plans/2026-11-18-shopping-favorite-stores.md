# Favorite stores and "כמה יעלה לי ב…" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The household stars favorite stores anywhere stores are listed, every priced store in every city is searchable, and "כמה יעלה לי ב…" prices the shopping list at the favorites.

**Architecture:** `favStores` joins the household doc and its PATCH. Pure helpers (parse, sort, search match, ingest keep rule) carry the logic and the tests. Two read-only routes (`/stores`, `/far`) reuse `rankStores`; the UI adds a `FavStar`, a cross-city picker search and a `Far` sheet.

**Tech Stack:** Next.js 15 App Router, MongoDB (native driver), `node --test` for import-free modules.

**Spec:** `docs/superpowers/specs/2026-11-18-shopping-favorite-stores-design.md`

## Global Constraints

- `MAX_FAV_STORES = 10`; at the cap the copy is exactly "אפשר עד 10 חנויות מועדפות".
- Favorites belong to the household (the `shoppingHome` doc, `_id: 'home'`).
- Plans, "כל החנויות" and compare stay on the user's city; far stores never enter them.
- Only priced stores are returned by any new route (`pricesAt !== null`, or a manual store with typed prices).
- The user's position never leaves the device (sorting by distance is client-side).
- Tested modules stay import-free apart from relative `.ts` imports (`node --test`, no `@/` alias).
- Node by absolute path: `/opt/homebrew/bin/node`; build with `MONGODB_URI=mongodb://127.0.0.1:27018/hatom-shopping-test`.
- Commits end with the session's `Co-Authored-By` trailer; push to `claude/shopping-ui-2812ad` only when the owner says so.

## Review Focus

- A favorite key whose store no longer exists or lost its prices: skipped on every read, never a 500 → pinned in Task 4 (`getStoresByKeys` filter) and Task 5 test.
- The picker merging the city's stores with search results: no store twice → Task 7 uses `mergeStores` from Task 2, tested there.
- A store search query of one letter or only spaces: no request, no results (not "every store") → Task 2 `storeMatches` test.
- "אני בסופר" opened on a store in another city: compared with that store's city → Task 6.
- A tap on ☆ when 10 favorites are saved: toast, nothing saved → Task 1 parser rejects 11; Task 7 checks before saving.

---

### Task 1: Favorites on the household doc

**Files:**
- Modify: `src/lib/shopping/home.ts` (types, `MAX_FAV_STORES`, `parseFavStores`)
- Modify: `src/models/ShoppingHome.ts` (`getHome` default, `set` accepts `favStores`)
- Modify: `src/app/api/shopping/home/route.ts` (PATCH `favStores`)
- Modify: `src/app/shopping/home-client.ts` (`saveHome` patch type)
- Test: `src/lib/__tests__/shopping-home.test.ts`

**Interfaces:**
- Produces: `ShoppingHome.favStores: number[]`; `MAX_FAV_STORES = 10`; `parseFavStores(v: unknown): Result<number[]>`; `saveHome(patch: { items?; list?; favStores?: number[] })`.

- [ ] **Step 1: Write the failing tests**

```ts
test('parseFavStores keeps order, dedupes, rejects non-integers and an 11th store', () => {
  assert.deepEqual(parseFavStores([3, 1, 3]), { ok: true, value: [3, 1] });
  assert.equal(parseFavStores([1.5]).ok, false);
  assert.equal(parseFavStores('x').ok, false);
  const r = parseFavStores(Array.from({ length: 11 }, (_, i) => i + 1));
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.error, 'אפשר עד 10 חנויות מועדפות');
  assert.deepEqual(parseFavStores([]), { ok: true, value: [] });
});
```

- [ ] **Step 2: Run it** — `/opt/homebrew/bin/node --test src/lib/__tests__/shopping-home.test.ts` → FAIL: no export `parseFavStores`.
- [ ] **Step 3: Implement** `parseFavStores` and `MAX_FAV_STORES` in `home.ts`; add `favStores: number[]` to `ShoppingHome`. `getHome()` returns `favStores: doc.favStores ?? []` (no migration). PATCH: accept `favStores` alone or with the others (update the "nothing to update" check), parse with `parseFavStores`, 400 with its error. `setHome` already takes `Partial<ShoppingHome>`.
- [ ] **Step 4: Run** the test file → PASS; `npx tsc --noEmit --incremental false --pretty false` → 0.
- [ ] **Step 5: Commit** `feat(shopping): household favorite stores on the home doc`.

### Task 2: Pure store helpers — sort, search, merge

**Files:**
- Modify: `src/lib/shopping/here.ts`
- Test: `src/lib/__tests__/shopping-here.test.ts`

**Interfaces:**
- Produces: `sortStores<S extends HereStore>(stores: S[], me: LatLng | null, favs?: ReadonlySet<number>)` (favorites first, each part ordered as today); `storeMatches(q: string, s: Pick<StoreInfo, 'chainName' | 'name' | 'address'> & { cityName: string }): boolean`; `storeQueryWords(q: string): string[]` (words of 2+ letters; empty → no search); `mergeStores<S extends { k: number }>(...lists: S[][]): S[]` (first occurrence wins).

- [ ] **Step 1: Write the failing tests**

```ts
test('sortStores: favorites first by distance, the rest as before', () => {
  const me = { lat: 32.06, lng: 34.77 };
  const near = store(1, { lat: 32.061, lng: 34.771 }, null);
  const far = store(2, { lat: 31.25, lng: 34.79 }, null);
  const mid = store(3, { lat: 32.08, lng: 34.78 }, null);
  assert.deepEqual(sortStores([near, far, mid], me, new Set([2, 3])).map((s) => s.k), [3, 2, 1]);
  assert.deepEqual(sortStores([near, far, mid], me).map((s) => s.k), [1, 3, 2]);
});

test('storeMatches: every word, across chain, branch, city and address', () => {
  const s = { chainName: 'רמי לוי', name: 'סניף העיר', address: 'הרצל 5', cityName: 'באר שבע' };
  assert.equal(storeMatches('רמי באר', s), true);
  assert.equal(storeMatches('רמי חיפה', s), false);
  assert.deepEqual(storeQueryWords(' א  '), []);
  assert.equal(storeMatches('א', s), false); // too short: no search, not "everything"
});

test('mergeStores keeps one copy of each store, first list first', () => {
  assert.deepEqual(mergeStores([{ k: 1 }, { k: 2 }], [{ k: 2 }, { k: 3 }]).map((s) => s.k), [1, 2, 3]);
});
```

- [ ] **Step 2: Run** `/opt/homebrew/bin/node --test src/lib/__tests__/shopping-here.test.ts` → FAIL (missing exports / sort ignores favs).
- [ ] **Step 3: Implement** in `here.ts`. In `sortStores`, compare `favs.has(a.k)` before `priced`. `storeMatches` returns false when `storeQueryWords(q)` is empty; otherwise every word is a substring of `` `${chainName} ${name} ${cityName} ${address}` ``.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(shopping): favorites-first store sort and store search helpers`.

### Task 3: Ingest — far cities and curated stores without a pin

**Files:**
- Modify: `src/lib/shopping/cities.ts` (`CityConfig.picker?: boolean`)
- Modify: `src/lib/shopping/ingest/locate.ts` (extract and reorder the keep rule)
- Modify: `src/app/shopping/page.tsx` (city picker lists `CITIES.filter((c) => c.picker !== false)`)
- Test: `src/lib/__tests__/shopping-locate.test.ts` (new)

**Interfaces:**
- Produces: `keepRule(s: { kind: 'physical' | 'online'; key: string; cityId: string | null }, ctx: { pinnedCities: ReadonlySet<string>; curated: ReadonlySet<string>; skipped: ReadonlySet<string> }): 'keep' | 'drop' | 'locate'`, exported from `locate.ts`; `keep()` calls it and geocodes only on `'locate'`.

- [ ] **Step 1: Write the failing test**

```ts
import { keepRule } from '../shopping/ingest/locate.ts';
const ctx = { pinnedCities: new Set(['tel-aviv']), curated: new Set(['yohananof/7']), skipped: new Set(['yohananof/9']) };
test('keepRule: a curated store is kept in a city with no pin', () => {
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/7', cityId: 'beer-sheva' }, ctx), 'keep');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'beer-sheva' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/9', cityId: 'tel-aviv' }, ctx), 'drop');
  assert.equal(keepRule({ kind: 'physical', key: 'yohananof/8', cityId: 'tel-aviv' }, ctx), 'locate');
  assert.equal(keepRule({ kind: 'online', key: 'x/1', cityId: null }, ctx), 'keep');
});
```

- [ ] **Step 2: Run** `/opt/homebrew/bin/node --test src/lib/__tests__/shopping-locate.test.ts` → FAIL (no export). If importing `locate.ts` pulls in something `node --test` can't load, put `keepRule` in `src/lib/shopping/places.ts` instead (already import-free) and record the ruling.
- [ ] **Step 3: Implement.** Order: online → keep; curated → keep; city not pinned → drop; skipped → drop; else locate. `keep()` uses it. Add `picker?: boolean` to `CityConfig` (no city sets it yet; the owner adds a far city with `picker: false`).
- [ ] **Step 4: Run** → PASS; `npm run shopping:ingest -- --offline --dry-run --chains yohananof` → completes (output says how many stores are kept).
- [ ] **Step 5: Commit** `feat(shopping): keep curated stores in pinless cities; far cities off the picker`.

### Task 4: Store search and favorites routes

**Files:**
- Modify: `src/models/ShoppingCatalog.ts`
- Create: `src/app/api/shopping/stores/route.ts`
- Modify: `src/lib/shopping/api-types.ts` (`StoresResponse`)

**Interfaces:**
- Consumes: `storeMatches`, `storeQueryWords` (Task 2); `getHome().favStores` (Task 1).
- Produces: `getPricedStores(): Promise<StoreDoc[]>` (priced physical + online, manual with typed prices); `getStoresByKeys(keys: number[]): Promise<StoreDoc[]>` (priced only, in `keys` order, unknown keys skipped); `GET /api/shopping/stores?q=` → `StoresResponse = { now: string; stores: HereStore[] }` (max 30; no `q` → the favorites). `locOf` moves from `here/stores/route.ts` to `ShoppingCatalog.ts` as `storeLoc(s)` so both routes share it.

- [ ] **Step 1: Implement** the two model functions and the route. Store count is small (hundreds), so filter in the route with `storeMatches` after one `getPricedStores()` (projection: the `StoreInfo` fields + `loc`); `cityName` from `CITIES` (online stores: "אונליין").
- [ ] **Step 2: Verify** against Docker Mongo on :3300: `/api/shopping/stores?q=רמי` lists only priced stores, each once; `?q=א` → `[]`; no `q` → the favorites; a bogus key in `favStores` (set via PATCH) is skipped, status 200.
- [ ] **Step 3: Commit** `feat(shopping): search every priced store; favorites by key`.

### Task 5: "כמה יעלה לי ב…" pricing route

**Files:**
- Modify: `src/lib/shopping/service.ts` (`priceAtStores`)
- Create: `src/app/api/shopping/far/route.ts`
- Modify: `src/lib/shopping/api-types.ts` (`StoreCardData`, `FarResponse`)

**Interfaces:**
- Consumes: `getStoresByKeys` (Task 4), `rankStores`, `idleDeals`, `promoDetails`.
- Produces: `StoreCardData = Pick<CompareResponse, 'now' | 'stores' | 'items' | 'promos' | 'idle'>`; `FarResponse = StoreCardData & { baskets: StoreBasket[] }` (complete baskets by total, then partial, the `rankStores` order); `priceAtStores(stores: StoreDoc[], req: Omit<CompareRequest, 'city'>): Promise<FarResponse>`; `POST /api/shopping/far { lines, clubs?, coupons? }`.

- [ ] **Step 1: Implement** `priceAtStores` from the same steps `compareBasket` runs (items, promos, manual prices, `rankStores`, idle, promo details) for the given stores only. Extract the shared item/promo/idle steps into a helper both call rather than copying them. Validate `lines` like compare (reuse its parser); the stores come from `getHome().favStores`.
- [ ] **Step 2: Verify** on :3300: two favorites in different cities → two baskets with totals; `favStores: []` → `baskets: []`; one stale key → priced without it. Compare (`POST /compare`) is unchanged (same totals before and after).
- [ ] **Step 3: Commit** `feat(shopping): price the list at the favorite stores`.

### Task 6: "אני בסופר" at a store in any city

**Files:**
- Modify: `src/app/api/shopping/here/route.ts`, `src/app/api/shopping/here/deals/route.ts`
- Modify: `src/app/shopping/Here.tsx` (requests drop `&city=`)

**Interfaces:**
- Produces: `GET /here?store=<k>` and `/here/deals?store=<k>` use `getStoreByKey(k)`'s `city`; 404 for an unknown, unpriced or online store; `city` param ignored if sent.

- [ ] **Step 1: Implement**: load the store first, then `getStoresFor(store.city)`.
- [ ] **Step 2: Verify** on :3300: a Beer Sheva store's `/here` names only Beer Sheva stores in `stores`; a Tel Aviv store as before.
- [ ] **Step 3: Commit** `feat(shopping): אני בסופר compares a store with its own city`.

### Task 7: Stars and favorites-first lists

**Files:**
- Modify: `src/app/shopping/ui.tsx` (`FavStar`)
- Modify: `src/app/shopping/page.tsx` (`favStores` save field, `toggleFav`, star on `StoreCard`)
- Modify: `src/app/shopping/Here.tsx` (picker: favorites, cross-city search, stars)
- Modify: `src/app/shopping/shopping.css`

**Interfaces:**
- Consumes: Task 1 (`saveHome`), Task 2 (`sortStores`, `mergeStores`, `storeQueryWords`), Task 4 (`/stores`).
- Produces: `FavStar({ on, name, onToggle }: { on: boolean; name: string; onToggle: () => void })`; page `toggleFav(k: number): void` (adds or removes; at `MAX_FAV_STORES` shows the toast "אפשר עד 10 חנויות מועדפות" and saves nothing); `StoreCard` gains `fav?: { on: boolean; toggle: () => void }`; `HereProps` gains `favs: ReadonlySet<number>` and `onFav: (k: number) => void`.

- [ ] **Step 1: Implement.** `Field` becomes `'list' | 'items' | 'favStores'` in the page's debounced save. `FavStar` is its own `<button>` (44 px, ☆/★, `aria-pressed`, labels "הוספה למועדפות: <name>" / "הסרה מהמועדפות: <name>", `stopPropagation`). The picker loads the city's stores as today plus `/stores` (no `q`) for favorites in other cities; with 2+ letters it queries `/stores?q=` (250 ms debounce, abort on change); lists are merged with `mergeStores` and sorted with `sortStores(…, me, favs)`.
- [ ] **Step 2: Verify** in the browser (:3300, 375 px, light + dark): ☆ in the picker and on a "כל החנויות" row fills and stays after reload; the starred store moves to the top of the picker; tapping ★ doesn't open the row; searching "באר שבע" from Tel Aviv lists Beer Sheva stores last, each once; picking one opens "אני בסופר" there; with 10 favorites a ☆ tap shows the toast.
- [ ] **Step 3: Commit** `feat(shopping): ☆ favorite stores, favorites first, search every city`.

### Task 8: The "כמה יעלה לי ב…" sheet

**Files:**
- Create: `src/app/shopping/Far.tsx`
- Modify: `src/app/shopping/page.tsx` (button on the list card; `StoreCard` / `Breakdown` take `StoreCardData`)
- Modify: `src/app/shopping/shopping.css`

**Interfaces:**
- Consumes: Task 5 (`POST /far`, `FarResponse`, `StoreCardData`), Task 7 (`FavStar`, `toggleFav`), Task 4 (`/stores?q=`).
- Produces: `Far({ list, clubs, coupons, favs, onFav, onClose })`, a sheet like `MyItemsSheet`.

- [ ] **Step 1: Implement.** A "כמה יעלה לי ב…" button on the list card (shown only when it renders, i.e. the list has items) opens it. It posts `/far` on open and whenever `favs` changes, and shows one `StoreCard` per basket with its ★. "+ הוספת חנות" opens the same store search as the picker; a result's ☆ adds it and the sheet re-prices. With no favorites it shows "עוד אין חנויות מועדפות. חפשו חנות וסמנו ☆." with the search open. Loading uses the existing skeleton; a failed request shows "לא הצלחנו לטעון. לנסות שוב".
- [ ] **Step 2: Verify** in the browser: favorites in two cities → two cards sorted by total, tap opens the breakdown; ★ removes a card; the club toggle changes totals; an empty list hides the button.
- [ ] **Step 3: Commit** `feat(shopping): כמה יעלה לי ב… — the list at the favorite stores`.

### Task 9: Docs and the full check

**Files:**
- Modify: `CLAUDE.md` (shopping: favorites, `/stores`, `/far`, far stores via `extra.json`)
- Modify: `docs/sources.md` (§ Small shops: adding a far store; `picker: false` cities)
- Modify: `docs/shopping-api.md` (the two routes)

- [ ] **Step 1: Write** the doc changes.
- [ ] **Step 2: Run** `npm test` (all pass), `npx tsc --noEmit --incremental false --pretty false` (0), `npm run lint` (clean), `MONGODB_URI=mongodb://127.0.0.1:27018/hatom-shopping-test npm run build` (exit 0).
- [ ] **Step 3: Commit** `docs(shopping): favorite stores and far stores`.
