# Shopping: no cities — your location, a radius and the favorites

Status: draft for the owner's review, 2026-11-18. Branch `claude/shopping-no-cities-2191e3`.

## Goal

Nobody using `/shopping` picks or sees a city. "Which stores count" is
decided by where you are (or the household's home spot) and the household's
★ favorites. The city picker, `settings.city` and `shopping_set_city` go away.

## What the owner decided

- **The near set** — the stores the plans ("הכי זול" / "חנות אחת"), "כל
  החנויות", the search's price range, the product view (eye / scan) and "אני
  בסופר"'s "cheaper elsewhere" all use:
  - physical stores (official, Wolt, manual) within a **straight-line radius**
    of the centre — default **1 km**; chips on the results widen it to
    **2, 5 or 10 km**; the last pick is remembered on the device
    (localStorage `shopping:radius`);
  - plus the household's **★ favorites** (`shoppingHome.favStores`, max 10),
    wherever they are;
  - plus **every online store**, in its own section as today.
  No routing per request.
- **The centre** is the live location (the browser's geolocation). Without
  one (GPS denied, iPhone Shortcuts, MCP tools) it is the household's **home
  spot**. Without either, the near set is the favorites plus online, and the
  page offers to set the home spot.
- **"אני בסופר"**: "cheaper elsewhere" measures the same radius around the
  store you are standing in (not around you), plus ★, plus that store itself.
- **A store with no map point** (`loc` null — an unplaced official store, a
  shop added without coordinates) is in the near set only when starred.
- **The home spot** is one point per household (`shoppingHome.homeSpot`).
  It is set from ⚙ → משק הבית with "שמירת המיקום הנוכחי כבית" (one GPS read)
  and shown as "הבית נשמר · ליד ‹nearest priced store›" with שינוי / מחיקה.
  The same button is offered inline when the page has no location. No map
  widget. Any household member can set or clear it.
- **The API** takes `lat` / `lng` (and `r`, the radius in km: 1, 2, 5 or 10)
  per request instead of `city`; the app never stores them (only the home
  spot, when a member saves it). The location goes only to our own API.
  On the GET routes (search, item, here/stores) they are in the URL, so the
  host's request logs may hold them briefly, rounded to ~11 m; compare sends
  them in its body. `POST /compare` also takes `favs` (the page's current
  favorites, so a star just tapped counts before its save lands).
- **MCP tools** take optional `lat`, `lng`, `radius_km` (1/2/5/10, default
  1); without them, the home spot. `shopping_set_city` is removed. With no
  location and no home spot, a tool answers with favorites + online and says
  the home spot can be set on the page (⚙ → משק הבית).
- **Migration: none.** The app stops reading and writing `settings.city`;
  trips stop sending `city`. Old docs keep the fields, harmlessly. The home
  spot starts empty — a city centre would be wrong at 1 km.
- **The ingest keeps pins and cities** as coverage areas (we can't price all
  of Israel on M0). `CITIES` / `cityOf` / `StoreDoc.city` stay as the
  ingest's internal shortcut. The ingest still writes `far` and `walkMin`;
  the app **ignores `far`** (distance from the user replaces it) and may still
  show `walkMin` ("דק׳ הליכה" from a pin). No ingest change in this work, so
  it doesn't collide with the Jerusalem / Mevaseret session; dropping `far`
  from the ingest is a later cleanup.

## Approach

Chosen: **filter in the app, in JS.** The stores collection is small (≈100
docs today, a few hundred with Jerusalem). Each request reads every
candidate store once (one `find`, the same cost as today's `getStoresFor`)
and keeps the near set with `distanceM` (haversine, already in
`places.ts`). No index, no schema change, no ingest change.

Rejected: a `2dsphere` index with `$geoWithin` (needs GeoJSON `loc` written
by the ingest and spends M0 index budget for a few hundred docs); having the
client choose store keys (moves pricing rules into the page and makes the
MCP tools a second implementation).

## Units

### `src/lib/shopping/near.ts` (new, import-free, `node --test`)

- `RADII_KM = [1, 2, 5, 10]`, `DEFAULT_RADIUS_KM = 1`.
- `type Centre = { lat: number; lng: number }`;
  `type Where = { centre: Centre | null; source: 'live' | 'home' | 'none'; radiusKm: number }`.
- `parseCentre(lat, lng)`: finite numbers in range (lat −90..90, lng
  −180..180), both or neither; rounded to 4 decimals (≈11 m). Returns the
  centre, null (neither given) or an error string.
- `parseRadius(raw)`: one of `RADII_KM`, else the default.
- `resolveWhere(given, homeSpot, radiusKm)`: the live centre if given, else
  the home spot, else none.
- `nearStores(stores, where, favs)`: keeps online stores; physical stores
  that are ★, or have a `loc` within `radiusKm` of the centre. Each kept
  physical store gets `distM` (from the centre; null without a point or a
  centre). Generic over `{ k, kind, loc }`.
- `distanceM` moves here from `places.ts` (re-exported there, so the ingest
  keeps its import).

### Read model (`src/models/ShoppingCatalog.ts`)

- `getStoresFor(city)` is replaced by `getCandidateStores()`: every store
  that is online with prices, physical with prices, or manual (listed before
  anyone types a price, as today). One `find`.
- `getStoresNear(where, favs)` = `nearStores(await getCandidateStores(), …)`.

### Service (`src/lib/shopping/service.ts`)

- `searchProducts(q, near)`, `itemPrices(raw, near)`,
  `compareBasket({ near, lines, clubs, coupons })`, where
  `near: { where: Where; favs: number[] }`. The far filter in
  `compareBasket` goes; every physical store in the near set competes in the
  plans.
- Responses carry `where: Where` instead of `city`. `StoreInfo` gains
  `distM: number | null` (from the centre; `far` was never sent to the page).
- One helper used by every route and tool:
  `nearFor(email, given: { lat?, lng?, r? })` → `{ where, favs }`
  (reads the caller's household once: home spot + favorites).

### Routes

| Route | Before | After |
|---|---|---|
| `GET search` | `?q&city` | `?q&lat&lng&r` |
| `GET item` | `?key&city` | `?key&lat&lng&r` |
| `POST compare` | `{ city, lines, … }` | `{ lat?, lng?, r?, lines, … }` |
| `GET here/stores` | `?city` — the city's physical stores | `?lat&lng` — physical stores within 10 km of you (or the home spot), plus ★ |
| `GET here?store` | compared with the store's city | `?store&r` — compared within `r` of the store, plus ★ |
| `GET stores?q` | shows city name | matches the ingest's city name as a search word (address often lacks it) but returns no city; the page shows distance from you |
| `POST far` | unchanged | unchanged (favorites, wherever) |
| `GET/PUT settings` | `{ nutritionHero, city }` | `{ nutritionHero }`; a `city` key is ignored |
| `GET/PATCH home` | — | gains `homeSpot: {lat,lng} \| null` (PATCH validates with `parseCentre`; `null` clears) |
| `POST trips` | requires `city` | `city` not required, not stored |

A request with neither `lat`/`lng` nor a home spot is valid: the answer is
favorites + online, `where.source = 'none'`.

### MCP (`src/lib/shopping/mcp-tools.ts`)

`city` props become `lat`, `lng`, `radius_km`; `cityFor` becomes `nearFor`.
Answers name the area as "within 1 km of home" / "within 2 km of the given
point" / "favorites only — no home spot set". `shopping_set_city` and its
`CITY_ALIASES` are removed.

### Page (`src/app/shopping/page.tsx`, `Here.tsx`, `Missing.tsx`, `shopping.css`)

- The location card (city name + "שינוי" + city chips) becomes a small line:
  "ליד המיקום שלך" / "ליד הבית" / "אין מיקום — שמירת בית" with a ↻ to read
  the location again. `nearestCity`, `CITY_CENTRES`, `LS_CITY*` go.
- The live location is read once on load and on ↻; it re-runs the compare
  only when it moved more than 150 m (so GPS jitter doesn't refetch).
- Radius chips (1 · 2 · 5 · 10 ק״מ) on the results, above the plan cards;
  `shopping:radius` in localStorage.
- Every `&city=` becomes the shared `nearQuery()` (`lat`, `lng`, `r`).
- Store rows show distance from you ("1.2 ק״מ") where they showed a city.
- Here: the picker lists `/here/stores` (sorted by distance on the device as
  today); the remembered store is no longer keyed by city.
- ⚙ → משק הבית gets the home-spot row.

## Errors and edge cases

- Bad `lat`/`lng` (one without the other, out of range, not a number) → 400.
  Unknown `r` → the default (not an error), so an old client keeps working.
- An old client still sending `city` and no `lat`/`lng`: `city` is ignored;
  the home spot (or favorites) is used. No 400.
- A favorite that's far away competes in the plans (that's what starring
  means); its row shows its distance.
- An empty near set (no store within 1 km, no favorites): the results say
  so and point at the radius chips.

## Testing

- `src/lib/__tests__/shopping-near.test.ts`: `parseCentre`, `parseRadius`,
  `resolveWhere`, `nearStores` (radius edge, ★ outside the radius, no `loc`
  with and without ★, online always kept, `distM`).
- Existing tests that build trips or settings drop `city`.
- Verify: `npm test`, `tsc`, `lint`, build against Docker Mongo; the page on
  a local dev server (own port) — compare with the radius chips, no-GPS
  fallback, home-spot save, "אני בסופר" picker and verdict, product view.

## Docs

`docs/shopping-api.md` (params, MCP table, no city list) and the CLAUDE.md
shopping section (city → near set; `far` ignored by the app).

## Addendum (owner, 2026-11-18, after the first review on :3110)

- **Walking time is live, not the pin's.** Every store's distance is measured
  from the current centre, and its walking time is an estimate from that
  distance: `walkMinutes(m) = max(1, round(m × 1.3 / 80))` (street detour
  factor 1.3, 80 m a minute). `StoreInfo.walkMin` now carries that estimate
  (null without a centre or a point); the ingest's routed `walkMin` from a pin
  is no longer shown anywhere (page, trips, MCP). Labels read
  "1.4 ק״מ · ~23 דק׳ הליכה".
- **The split plan shows the walk between stores.** "הכי זול" over 2–3 stores
  orders its stops as a walk — nearest to the centre first, then the store
  nearest to that one (`walkOrder` in near.ts) — and shows each leg
  ("↓ 650 מ׳ · ~11 דק׳") and the total walk. `StoreInfo` gains `loc` (store
  addresses are public). Without a centre the walk starts at the first stop.
- **Manual location by address search.** The footer's "שינוי מיקום" opens a
  sheet: type an address and suggestions appear as you type (300 ms debounce,
  from 2 letters, no search button; Enter takes the first), up to 6 places in
  Israel. The picked point becomes the centre ("ליד ‹address›"), remembered on
  the device (localStorage `shopping:place`) until "המיקום שלי". The same sheet
  saves the picked point (or the GPS one) as the home spot — so a home spot can
  be set without GPS. Geocoding goes through our own
  `GET /api/shopping/geocode?q=` to Photon (komoot's OpenStreetMap geocoder,
  built for search-as-you-type — Nominatim's usage policy forbids
  autocomplete), inside Israel's bounding box, generic app User-Agent, no
  user identity and no location bias (typed text only): the browser never
  calls a third party and the CSP is unchanged. Results are cached in memory.
- **The plan cards use only stores within the radius** (owner, after review):
  "הכי זול" / "חנות אחת" are built from physical stores measured within the
  radius (`withinRadius` in near.ts). ★ favorites farther away (or with no
  point) are still listed in "כל החנויות" and priced in "כמה יעלה לי ב…", but
  never win a plan. With no centre there are no plan cards.
