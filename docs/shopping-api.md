# Shopping: API and MCP tools

Two ways for something other than the page to use `/shopping`: the REST
routes (Shortcuts, scripts) and the MCP tools (AI assistants: claude.ai,
ChatGPT, Copilot). Both act as the signed-in person, with their live
`shopping` permission, and see only the lists that person can see.

## Credentials

- **Personal API key** (`htm_…`): create it on the site (profile → API key),
  send `Authorization: Bearer htm_…`. Works for the REST routes and `/api/mcp`.
- **OAuth** (`hto_…`): what claude.ai / ChatGPT connectors get when you add
  `https://www.hatom.im/api/mcp` as a connector and approve it. MCP only.

## MCP tools (`/api/mcp`)

Answers are plain text the model reads back: prices in ₪, each store with
its walking time, Wolt prices marked as delivery prices and typed prices as
typed. Products can be named in free text (Hebrew or English, typos ok), a
barcode or an item key; free text takes the search's best match (the page's
ranking) and the answer names the runner-ups so the model can correct it.

| Tool | What people ask | Notes |
|---|---|---|
| `shopping_search` | "How much is Bamba?" | Top 8 matches: price range, store count, cheapest store, key. |
| `shopping_product_prices` | "Is ₪7.90 for cottage cheese cheap?" | Every nearby store, cheapest first, deals applied. With `price`: a verdict against the cheapest and typical single-unit price, plus the multi-buy deal that beats it. |
| `shopping_lists` | "What lists do I have?" | Id, name, item count, shared/personal. |
| `shopping_get_list` | "What's on the weekly list?" | |
| `shopping_add_items` | "Add milk, 2 cottage and a kilo of tomatoes" | Several at once; an item already on the list gets its quantity raised; quantities are units or kg. |
| `shopping_remove_items` | "Take the Bamba off", "only one cottage" | By key or part of the name; `qty` lowers instead of removing. |
| `shopping_create_list` | "Start a list for the party" | Personal unless `shared`. |
| `shopping_compare` | "Where should I shop for my list?" | Cheapest single store, the cheapest 2–3-store split when it saves enough (the plan cards' rule), top 5 stores with what each lacks, best online store. `clubs` adds club deals. |
| `shopping_set_city` | "I'm in Ramat Gan" | Saved in the user's shopping settings and used whenever a tool gets no `city`. |

`list` is optional everywhere (a name, part of it, or an id; default: the
most recently changed list). `city` is optional once one is saved; without
either, the tool answers with the list of cities so the model asks.

Code: `src/lib/shopping/mcp-tools.ts`, registered in `src/app/api/mcp/route.ts`
with permission `shopping`. The queries are the page's own
(`src/lib/shopping/service.ts`), so an assistant and the page always agree.

## REST routes

All under `/api/shopping`, Bearer key or the site session. Prices are in
agorot. The shapes are in `src/lib/shopping/api-types.ts`.

| Route | Purpose |
|---|---|
| `GET search?q=&city=` | Products matching every word (`SearchHit[]`). |
| `GET item?key=&city=` | One product at every store (`ItemResponse`); `key` may be a barcode. |
| `POST compare` `{ city, lines: [{key, qty}], clubs?, coupons? }` | A basket at every store, plans and splits (`CompareResponse`). |
| `GET lists`, `POST lists` `{ name, shared? }` | The caller's lists; create one. |
| `GET/PATCH/DELETE lists/<id>` | Read, change (`{ name?, items?, shared? }`), delete. |
| `GET/PUT settings` `{ nutritionHero?, city? }` | The caller's preferences, incl. the saved city. |
| `PUT manual-prices` `{ store, item, price }` | Type a neighbourhood shop's price (agorot; null clears). |

Cities: `tel-aviv`, `ramat-gan`, `beer-sheva`.
