# Shopping: API and MCP tools

Two ways for something other than the page to use `/shopping`: the REST
routes (Shortcuts, scripts) and the MCP tools (AI assistants: claude.ai,
ChatGPT, Copilot). Both act as the signed-in person, with their live
`shopping` permission. There is one household "My items" and one shopping list,
shared by everyone with that permission.

## Credentials

- **Personal API key** (`htm_…`): create it on the site (profile → API key),
  send `Authorization: Bearer htm_…`. Works for the REST routes and `/api/mcp`.
- **OAuth** (`hto_…`): what claude.ai / ChatGPT connectors get when you add
  `https://www.hatom.im/api/mcp` as a connector and approve it. MCP only.

## MCP tools (`/api/mcp`)

Answers are plain text the model reads back: prices in ₪, each store with
its distance and estimated walking time, Wolt prices marked as delivery prices and typed prices as
typed. Products can be named in free text (Hebrew or English, typos ok), a
barcode or an item key; free text takes the search's best match (the page's
ranking) and the answer names the runner-ups so the model can correct it.

| Tool | What people ask | Notes |
|---|---|---|
| `shopping_search` | "How much is Bamba?" | Top 8 matches: price range, store count, cheapest store, key. |
| `shopping_product_prices` | "Is ₪7.90 for cottage cheese cheap?" | Every nearby store, cheapest first, deals applied. With `price`: a verdict against the cheapest and typical single-unit price, plus the multi-buy deal that beats it. |
| `shopping_my_items` | "What do we usually buy?" | The household's My items with their usual quantities. |
| `shopping_get_list` | "What's on the list?" | The one shopping list. |
| `shopping_add_items` | "Add milk, 2 cottage and a kilo of tomatoes" | Several at once; an item already on the list gets its quantity raised; a product not yet among My items is saved there too; quantities are units or kg. |
| `shopping_remove_items` | "Take the Bamba off", "only one cottage" | By key or part of the name; `qty` lowers instead of removing. |
| `shopping_compare` | "Where should I shop for my list?" | Cheapest single store, the cheapest 2–3-store split when it saves enough (the plan cards' rule), top 5 stores with what each lacks, best online store. `clubs` adds club deals. |

**Where** (search, product prices, add, compare): optional `lat` + `lng`
(decimal degrees, both or neither) and `radius_km` (1, 2, 5 or 10; default 1).
Without them the household's home spot is used (set on the page: ⚙ → משק
הבית). The stores counted are those within the radius, plus the household's
★ favorites wherever they are, plus every online store; with no point and no
home spot, favorites and online only, and the answer says so.

Code: `src/lib/shopping/mcp-tools.ts`, registered in `src/app/api/mcp/route.ts`
with permission `shopping`. The queries are the page's own
(`src/lib/shopping/service.ts`), so an assistant and the page always agree.

## REST routes

All under `/api/shopping`, Bearer key or the site session. Prices are in
agorot. The shapes are in `src/lib/shopping/api-types.ts`.

The pricing routes take `lat`, `lng` (both or neither; only for that request,
never stored) and `r` (km: 1, 2, 5 or 10; anything else = 1). Without
`lat`/`lng` they use the household's home spot; responses say which in
`where: { centre, source: 'live' | 'home' | 'none', radiusKm }`. Each store
carries `distM` (metres from the centre), `walkMin` (an estimate:
straight line × 1.3 at 80 m a minute — not a route) and `loc`. Only one of
`lat`/`lng`, or a non-coordinate, is a 400. A `city` from an old client is
ignored.

| Route | Purpose |
|---|---|
| `GET search?q=&lat=&lng=&r=` | Products matching every word, priced at the near stores (`SearchHit[]`). |
| `GET item?key=&lat=&lng=&r=` | One product at every near store (`ItemResponse`); `key` may be a barcode. |
| `POST compare` `{ lat?, lng?, r?, favs?, lines: [{key, qty}], clubs?, coupons? }` | A basket at every near store, and plans (`CompareResponse`). `favs`: favorite store keys to count instead of the saved ones (the page sends its current stars). |
| `GET here/stores?lat=&lng=` | "אני בסופר" picker: physical stores within 10 km, plus ★ (`HereStoresResponse`). |
| `GET here?store=&r=` | "אני בסופר": My items here vs the stores within `r` km of that store, plus ★ (`HereResponse`). |
| `GET home` | The caller's household: My items, the list, the favorite stores and the home spot (`{ id, members, invites, items, list, favStores, homeSpot, updatedAt, meta }`; `meta` = department and photo per key). Every route here is scoped to the caller's household. |
| `PATCH home` `{ items?, list?, favStores?, homeSpot? }` | Replace My items, the list, the favorite stores (store keys, max 10) and/or the home spot (`{ lat, lng }`, or `null` to clear). |
| `GET household` | Members (with names), pending invites, and invites to the caller (`HouseholdResponse`). |
| `POST household` `{ invite }` \| `{ cancel }` \| `{ accept }` \| `{ decline }` \| `{ leave: true }` | Invite an email with shopping access, cancel it, answer an invite, or leave (answers with `HouseholdResponse`). |
| `GET stores?q=` | Priced stores anywhere matching every word of `q` (chain, branch, town, address; 2+ letters; max 30); without `q`, the favorites (`StoresResponse`). |
| `POST far` `{ stores, lines: [{key, qty}], clubs?, coupons? }` | "כמה יעלה לי ב…": the list at each of `stores` (the favorites, wherever they are; `FarResponse`). |
| `POST home/list` `{ add: [{key, qty}] }` | Put My items on the list ("מה חסר?"); items already there keep their quantity. |
| `GET/PUT settings` `{ nutritionHero? }` | The caller's preferences. |
| `GET geocode?q=` | Up to 6 places in Israel for an address, as you type (`{ places: [{ label, lat, lng }] }`), via Photon (OpenStreetMap) on our side (typed text only, no location; cached). |
| `PUT manual-prices` `{ store, item, price }` | Type a neighbourhood shop's price (agorot; null clears). |
