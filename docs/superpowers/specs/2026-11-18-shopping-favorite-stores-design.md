# Shopping: favorite stores and "כמה יעלה לי ב…"

Status: approved design, 2026-11-18. Branch `claude/shopping-home` → PR #10.

## Goal

Price the household's shopping list at the stores it cares about, near or
far: "what would this list cost me at Yochananof in Beer Sheva?" Stores are
starred as favorites wherever stores are listed, every priced store in every
city is searchable, and the minimal home page stays as it is.

## What the owner decided

- **Favorites belong to the household** (one shared set, like My items).
- **"כמה יעלה לי ב…" opens from the shopping-list card**, shown only when
  the list has items.
- **A far store is a regular store.** It is added by the owner through the
  existing `places/extra.json` + discovery review, priced by the daily ingest
  like any store. Nothing in the app triggers the ingest, and there is no
  "prices coming" state: only priced stores exist in the app.
- **Every priced store is searchable**, in every city; far ones sort last by
  distance.
- **A ☆/★ on every store row** adds or removes a favorite in one tap.
- **Favorites are listed first** in distance-sorted lists, nearest first.
- **Plans and "כל החנויות" stay on the user's city.** A far store never wins
  a plan; it shows up in "כמה יעלה לי ב…", in search, and in "אני בסופר"
  when picked.

## Data

- `shoppingHome` gains `favStores: number[]` (store keys), at most
  `MAX_FAV_STORES = 10`. Parsed in `src/lib/shopping/home.ts`
  (`parseFavStores`: integers, deduped, order kept, cap enforced, error text
  "אפשר עד 10 חנויות מועדפות"). Saved through the existing
  `PATCH /api/shopping/home` (`{ favStores }`), merged into the same
  debounced save as `items` / `list`. A missing field reads as `[]`; no
  migration.
- Keys that no longer resolve to a priced store are ignored on read (a store
  dropped by a later ingest), not removed: if it comes back, so does the star.
- No new collection, no new store field.

## Ingest (two small changes, no new files)

1. **Cities.** A store outside `CITIES` gets `cityId: null` and is dropped
   (`ingest/cli.ts`). A far city the owner wants (e.g. Holon) is added to
   `CITIES` with its CBS code and aliases. `CityConfig` gains
   `picker?: boolean` (default true); a city added only for far stores sets
   `picker: false` so the city picker doesn't offer a city with two stores.
2. **Curated before pins.** `ingest/locate.ts` `keep()` skips a store whose
   city has no pin *before* it checks `curated`. Move the `curated` check
   first, so an official store matched to a shop the owner included in the
   review is kept in any target city, pin or no pin (the documented rule:
   "an official store a curated entry points to is always kept").

Owner's flow for a far store: add the shop to `places/extra.json` → `npm run
shopping:discover` → include it in the review (or hand-match it in
`places/official.json`) → `npm run shopping:ingest`.

## API

- `GET /api/shopping/stores?q=<text>` — every priced store (physical and
  online; manual stores with typed prices too) whose `chainName name city
  address` contains every word of `q` (≥ 2 letters), max 30, each as
  `HereStore` (`StoreInfo` + `loc` + `priced`). Without `q`: the favorites.
  The page sorts on the device (the position never leaves it). Model:
  `searchStores(q)` / `getStoresByKeys(keys)` in `ShoppingCatalog.ts`.
- `POST /api/shopping/far` `{ lines, clubs?, coupons? }` — the list priced
  at each favorite (`getStoresByKeys(home.favStores)`, any city, priced only)
  with the existing `rankStores`, sorted like the store ranking (complete
  baskets by total, then partial). Response: the `CompareResponse` subset the
  `StoreCard` needs (`now, stores, items, baskets, promos, idle`).
  Read-only.
- `GET /api/shopping/here?store=<k>` — `city` is no longer required: the
  store's own city (from its doc) picks the stores it's compared against.
  An online store is refused as today.
- `GET /api/shopping/here/stores?city=` keeps listing the city's stores;
  the picker adds the favorites from other cities (via `/stores`) and the
  search results.

## UI

- **`FavStar`** (new, `src/app/shopping/ui.tsx`): a 44 px button with ☆ / ★,
  `aria-pressed`, label "הוספה למועדפות: <store>" / "הסרה מהמועדפות: <store>".
  Its own button (stopPropagation), so it never opens a row. At the cap a tap
  shows the toast "אפשר עד 10 חנויות מועדפות" and changes nothing.
  The page owns `favStores` (from `home`) and passes `isFav` / `onFav`.
- **Where it appears:** "אני בסופר" store picker rows; `StoreCard` heads in
  "כל החנויות" (physical and online); "כמה יעלה לי ב…" rows (★ removes).
- **Order:** `sortStores(stores, me, favs)` in `here.ts` puts favorites
  first (nearest first), then today's order (priced, distance, walk, name).
  Price rankings ("כל החנויות", "כמה יעלה לי ב…") keep their price order and
  only show the star.
- **"אני בסופר" picker:** the filter box searches all cities through
  `/stores?q=` (debounced 250 ms) once it has 2+ letters; results merge with
  the city's stores, deduped, sorted as above (far stores last). Favorites
  from other cities are listed at the top even without a query. Picking a
  store in another city opens it; its comparisons use that city.
- **"כמה יעלה לי ב…"** (new `Far.tsx`, a sheet like `MyItemsSheet`):
  - Opened by a button on the list card ("כמה יעלה לי ב…"), list non-empty.
  - One `StoreCard` per favorite (rank, store, total, missing count, price
    date), tap → its breakdown; ★ on each.
  - "+ הוספת חנות": the same store search; a result's ☆ adds it and the
    sheet re-prices.
  - No favorites: "עוד אין חנויות מועדפות. חפשו חנות וסמנו ☆." with the
    search open.
  - Uses the list card's club/coupon toggles.

## Not in this spec

- A Hazi Hinam price source (own site, `docs/sources.md` § Access methods;
  its Stores file looked partial) — its own follow-up.
- Favorites in plans, "אני בסופר" suggestions or the MCP tools.

## Testing

- `node --test`: `parseFavStores` (cap, dedupe, non-integers rejected);
  `sortStores` with favorites (favorites first by distance, then the rest
  unchanged); store-search word matching (pure helper in `here.ts`); the
  `keep()` ordering as a pure check if it can be extracted, else covered by
  an `--offline --dry-run` ingest with a curated store in a pinless city.
- Browser (:3300, Docker Mongo, mobile width, light + dark): star from the
  picker and from "כל החנויות", favorites first in the picker, search a
  Beer Sheva store from Tel Aviv, open it in "אני בסופר", open
  "כמה יעלה לי ב…" with favorites in two cities, remove one with ★, the cap
  toast.

## Review focus

- A favorite key whose store was dropped by a later ingest: ignored, no
  crash, star returns if the store does.
- `/far` with many favorites and a long list: bounded (10 × list), one
  `getItems` + `getPromosFor` call, not per store.
- Store search must not return unpriced or bookkeeping stores.
- The picker's merged list must not show a store twice (city list + search).
- `here?store=` for a store in another city compares against that city, not
  the user's.
