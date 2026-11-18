# Shopping: "אני בסופר" (I'm at the supermarket)

Design, 2026-11-17; the owner's answers are in § Decisions. A second way into the store, next to
the trip in [shopping-in-store-mode.md](shopping-in-store-mode.md):

| | Trip (built) | אני בסופר (this doc) |
|---|---|---|
| Starts from | A list → a plan → "יוצאים לקניות" | A store you're standing in |
| Answers | "What do I take, and where?" | "What's worth buying **here**?" |
| Typical use | Planned weekly shop | Popped into a shop; passing by; checking a deal at the shelf |

## Entry and store choice

- **Entry:** a "📍 אני בסופר" button in the page header, always visible
  (it does not need a list). On a phone it is the fourth item of the bottom bar.
- **Store picker**, a bottom sheet:
  - Sorted by **live distance** when the browser grants location
    (`navigator.geolocation`, already asked for city detection). The sort runs
    **on the device**: the page gets every city store's coordinates and never
    sends the user's position to the server.
  - Without location: sorted by `walkMin` (from the pins), then name.
  - The nearest store within ~80 m is preselected: "נראה שאתה ב**רמי לוי
    פלורנטין** – נכון?" with one tap to confirm.
  - Each row: chain logo/name, branch, distance ("120 מ׳") or walking time,
    the price-file date badge it already has (`SourceBadge`).
  - The last chosen store is remembered for 2 hours (localStorage), so
    reopening the page in the store goes straight back in.
- If an **open trip** has a stop at this store, the screen's top shows "יש
  טיול פתוח עם 9 מוצרים כאן → לרשימה" (to the existing checklist).

## The screen

Full-screen, like the trip screen. Header: store name, "מחירים מ־היום 07:00",
a ✕ to leave. A big round **scan button** floats at the bottom (thumb zone).
Below the header, three tabs:

### 1. כדאי כאן (worth buying here)

From **all of My items** (the household's usual products; since 2026-11-18 there
are no named lists), each priced here and at every physical store in the city,
deals applied (the same `rankStores` the compare uses, one unit each). When
there is a shopping list (built in "מה חסר?"), its items come first under
"רשימת הקניות" at the list's quantity, then the rest under "עוד מהמוצרים
שלי" at their usual quantity; each part has the groups below. Without a list,
just the groups. The deals tab's first section is "במוצרים שלי", list first.

| Group | Rule (constants, open to tuning) | Row shows |
|---|---|---|
| **הכי זול כאן** | Here is the cheapest, or within `HERE_TIE` = max(₪0.50, 3%) of it | Price here, "הכי זול בעיר" or "כמו ב־X", deal label |
| **סביר** | Elsewhere is cheaper, but by less than `HERE_WORTH_WALK` = ₪3 for the list's quantity | "₪1.20 פחות ב־X – לא שווה הליכה" |
| **עדיף במקום אחר** | Cheaper elsewhere by ₪3+ for the list's quantity | "₪6.40 פחות ב־שופרסל (8 דק׳)" |
| **אין כאן** | The store doesn't sell it (no price) | Collapsed count |

- Sorted inside a group by saving (biggest first).
- **Tap a row** → the existing `ProductSheet` with this store highlighted.
- **Read-only towards the lists**: this screen never ticks, removes or changes
  list items (no "קניתי"). Lists are only an input to "what's worth it here".
- Items whose price at this store is a deal get the deal label and end date.

### 2. מבצעים (deals here)

Deals active now at this store (`s ≤ now ≤ e`, `stores` includes it), in
three sections:

1. **On your lists**: deals touching any list item. With the deal finisher:
   "3 ב־₪20 – ברשימה 2, להוסיף עוד אחד?".
2. **You bought before**: items from past trips (`shoppingTrips` ticks) that
   are on a deal here.
3. **All deals**: the rest, biggest saving first, with department chips
   (`DEPARTMENTS`) to filter. "+ לרשימה" on each.

Each row: photo, name, "₪9.90 במקום ₪14.90" or the multi-buy text, the saving
%, "נגמר מחר" when it ends within 48 h, club/coupon tags (shown, not counted
unless the list's club toggle is on). Deals whose only description we can't
parse are listed with their description and no saving.

### 3. Scan (the floating button)

Opens the existing `Scanner`. The result is a **verdict card** over the
camera, not the full product sheet:

- 🟢 **כדאי כאן**: here ≤ cheapest + `HERE_TIE`. "₪12.90 – הכי זול באזור".
- 🟡 **סביר**: cheaper elsewhere by less than ₪3. "₪1.10 פחות ב־ויקטורי".
- 🔴 **עדיף ב־X**: "₪9.90 ב־רמי לוי (6 דק׳) – ₪3.00 פחות". Plus, when this store
  has one, a **cheaper twin here**: "או: ריבת תות של יכין ב־₪8.40 כאן" (the
  `/api/shopping/alternatives` lookup the trip's "לא היה" uses).
- No price here: "אין לנו מחיר לחנות הזאת" + "המחיר על המדף?" (see below).
- Actions: "+ לרשימה", "סרוק עוד", "פרטים" (full `ProductSheet`).
- If a trip is open and the item is planned at another stop: "מתוכנן לקנות
  ב־X ב־₪Y".

The verdict compares against **physical stores in the city** (already limited
to the pins' walking radius by the ingest). Online stores are not part of the
verdict; the full sheet still lists them.

## More ideas (asked: "can you think of more?")

Recommended for v1 are marked ★.

1. ★ **Cheaper twin here** (in the scan card above): when the scanned item is
   cheaper elsewhere, suggest a similar item this store sells for less.
2. ★ **Deal finisher** (in tab 2): "one more and the deal kicks in".
3. ★ **The shelf price is different**: one tap in the scan card → type the shelf
   price. At a manual shop it saves a manual price (the existing PUT
   `/api/shopping/manual-prices`); at a chain it saves a **price report**
   (`shoppingPriceReports`), shown as "דווח מחיר אחר במדף" on that store's
   price for 3 days. Chain prices are never overwritten.
4. **Unit-price duel**: scan two products → "החבילה הגדולה זולה ב־18% לק״ג".
   Uses `um`/unit price from the item docs. Small, fun, offline-friendly.
5. **Expiring deals** first in tab 2 ("נגמר היום / מחר").
6. **Club price** per chain: remember which clubs the household has, and show
   the club price as the price here.
7. **"Is this deal real?"**: compare the deal price with the regular price at
   the other chains. Needs no history: "מבצע ₪9.90; בלי מבצע ברמי לוי ₪8.90".

## API

All under `/api/shopping/here/*`, permission `shopping` (`requireFeatureCaller`).

- `GET /api/shopping/here/stores?city=<id>` → `StoreInfo[]` for the city's
  physical stores, each with `loc: { lat, lng } | null`. The client sorts by
  distance. (Could instead be a `loc` on `StoreInfo` everywhere.)
- `GET /api/shopping/here?store=<k>` (since 2026-11-18 the store's own city
  picks the stores it's compared with; the picker also searches every city via
  `GET /api/shopping/stores?q=`) →
  ```ts
  interface HereResponse {
    now: string;
    store: StoreInfo;
    stores: Record<number, StoreInfo>; // every store named below
    items: Record<string, ItemMeta>;   // as CompareResponse.items
    rows: HereRow[];                   // tab 1
    deals: { mine: HereDeal[]; before: HereDeal[] }; // tab 2, sections 1–2
    promos: Record<string, PromoDetail>;
  }
  interface HereRow {
    key: string; qty: number; onList: boolean; // list qty, else My items' usual
    here: ItemPrice | null;           // null = not sold here
    best: ItemPrice | null;           // cheapest physical store in the city
    group: 'best' | 'ok' | 'elsewhere' | 'missing';
    saving: number;                   // agorot for the list's qty, 0 in 'best'
  }
  ```
  Server: the household doc (`getHome`), `hereLines(list, myItems)`,
  `getItems` + `getPromosFor` + `getStoresFor(city)`, then `rankStores` per
  item. The grouping is a pure function `groupHere()` in
  `src/lib/shopping/here.ts` (import-free, unit-tested).
- `GET /api/shopping/here/deals?store=<k>&d=<dept>&page=<n>` → tab 2 section 3,
  from the precomputed per-store deals doc (below), 30 per page.
- The scan card reuses `GET /api/shopping/item?key=&city=` and computes the
  verdict on the client with the same `verdict()` helper from `here.ts`
  (the item route already returns every physical store's price).
- `POST /api/shopping/price-reports` `{ store, item, price }` (idea 3).

## Data model

- **`StoreDoc.loc: { lat, lng } | null`** (ingest). The coordinates already
  exist in the ingest's caches (`places/geocode.json` for official stores via
  `ingest/locate.ts`; the reviewed places for small shops and Wolt). Online
  stores: null.
- **`shoppingStoreDeals`** (ingest-written, new): one doc per physical store,
  `{ _id: storeKey, at, deals: [{ promo, item, price, regular, pct, end, d }] }`,
  the store's active single-item deals with a computable saving, biggest first,
  capped at ~400 per store. Precomputing keeps the M0 budget: no new multikey
  index on `promos.stores`, and tab 2 is one `findOne`. Multi-item deals
  ("any 2 of these") are included once per item with the per-unit saving.
- **`shoppingPriceReports`** (app-written, idea 3): `{ store, item, price, by,
  at }`, TTL index on `at` (7 days).
- Lists, trips: unchanged. "You bought before" reads `shoppingTrips.ticked`.

## Ingest side

1. Write `loc` on store docs from the caches `locate.ts` already reads. A store
   whose address never geocoded keeps `loc: null` and sorts by `walkMin`.
2. After promos are built, compute `shoppingStoreDeals` per physical store
   in the target cities: for each active promo × item at that store, saving =
   regular price × min − deal total (the same reading as `pricing.ts`, so
   reuse it, not a second interpreter). Write only when the doc's hash changes,
   like the other collections.
3. Size check: ~60 physical stores × 400 deals × ~80 B ≈ 2 MB. Fine on M0.

## Decisions (owner, 2026-11-17)

1. **Thresholds** as proposed: `HERE_TIE` = max(₪0.50, 3%), `HERE_WORTH_WALK` = ₪3.
2. **All lists** feed "כדאי כאן". (2026-11-18: all of My items, the shopping
   list's first.)
3. **No "קניתי"**: the screen is unrelated to editing lists. It reads them; the
   only write is "+ לרשימה".
4. **No cart total / "כמה שילמת?"**: dropped as a bad feature. (The trip's
   end-of-trip "כמה שילמת?" from shopping-in-store-mode.md is dropped too; see
   that doc's follow-up.)

## Still open

1. **Auto-detect** ("נראה שאתה ב…"): OK to ask for location each time the
   picker opens? No background tracking is planned.
2. Small shops with hand-typed prices: include them in tab 1's comparison
   (they're in `physical` once fully priced), or only chains?

## Status (2026-11-17, PR #10)

Built:
- Entry button "אני בסופר", store picker: **stores with prices first** (a price
  file, or a hand-priced shop with at least one typed price), then the rest
  under "חנויות שאין לנו מחירים מהן"; inside each part by distance when stores
  have `loc`, else by `walkMin`. 2-hour memory; the nearest store within 80 m
  is suggested whichever part it's in. `GET /api/shopping/here/stores`.
- `GET /api/shopping/here` and tab 1 "כדאי כאן" with the four groups and list chips.
- Tab 2, in this order: "ברשימות שלך" (with the deal finisher), "קנית בעבר",
  then **"עוד מבצעים בסניף"**: every item's best deal at the store now,
  biggest share saved first, with department chips, 30 at a time
  (`GET /api/shopping/here/deals`, `storeDeals()` in `here.ts`). It reads the
  promos straight from Mongo (no index on `stores`; ~500–900 active deals
  per branch, ~200 ms locally), so `shoppingStoreDeals` isn't needed yet.
  Deals that make the item free are left out: chains publish gift and
  compensation coupons ("קופון פיצוי", "… מתנה") as plain deals.
- The bottom bar: **text search** (the main page's search) or a barcode typed
  or scanned; a result shows the verdict card, with the cheaper twin here.
- Open-trip handoff. Tests in `shopping-here.test.ts`.
- Ingest: `loc` on every physical store doc (add56df on feature/shopping-ingest,
  the point the walking time is routed from; online stores `loc: null`).
  Checked 2026-11-17 with a position 30 m from Victory Florentin: "לפי
  המרחק ממך", the suggestion "נראה שאת/ה בויקטורי פלורנטין · 30 מ׳ ממך", and
  both parts of the list by distance.

Not built yet:
- Shelf-price reports.
- The twin compares shelf prices, not unit prices: a bigger pack can show as "cheaper".

## Order of work

1. Ingest: `loc` on stores. App: `/here/stores`, the store picker with
   distance sort and the 2-hour memory. Entry button.
2. `here.ts` (`groupHere`, `verdict`, tests) and `GET /api/shopping/here`;
   tab 1 with tap-to-sheet.
3. Scan verdict card (reuses Scanner + item route), with the cheaper twin.
4. Ingest: `shoppingStoreDeals`. Tab 2 (mine / before / all + department chips)
   and the deal finisher.
5. Open-trip handoff, shelf-price reports.
6. Later: unit-price duel, club prices, "is this deal real".
