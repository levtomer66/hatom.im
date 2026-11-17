# /shopping: "My items" and one shopping list

Status: approved in chat 2026-11-18, waiting for spec review.

## Why

Named shopping lists (chips, create, rename, share/personal) are more than the
household needs. What we actually do is buy roughly the same products every
week. So the page keeps one household catalogue of the products we usually
buy ("My items") and builds one shopping list from it by asking "מה חסר?".

## Decisions (from the user)

| Question | Answer |
|---|---|
| Who owns My items and the list? | One per household: everyone holding the `shopping` permission shares both. |
| After a shop | Ending a trip removes what was ticked; what was marked not-there stays. My items never shrink by themselves. |
| Search / scan → add | Saves to My items. Inside "מה חסר?" you can also search and add a new product to My items (and it is ticked for this shop). |
| Quantity | Each My item has a usual quantity; "מה חסר?" adds that amount; it can be changed on the list for this shop. |

## Data

New collection `shoppingHome`, a single document with `_id: 'home'`:

```ts
interface MyItem   { key: string; name: string; w: boolean; qty: number; addedBy: string; addedAt: string }
interface ListLine { key: string; name: string; w: boolean; qty: number }   // = today's ShoppingListItem
interface ShoppingHome { items: MyItem[]; list: ListLine[]; updatedAt: string }
```

- Limits: `items` ≤ 300, `list` ≤ 100 (today's `MAX_LIST_ITEMS`). Quantities go
  through the existing `normalizeQty` (whole units; 0.05 kg steps when weighted).
- Keys use the existing `KEY` pattern (barcode or `<chainId>:<code>`).
- Writes replace a whole array (`items` or `list`), as list PATCHes do today.
  Last write wins; the household is two people, and today's lists already work
  this way. Ending a trip uses `$pull` on `list` so it doesn't race an edit.
- `ListLine` is exactly today's list item, so `/api/shopping/compare`, plans,
  per-item and in-store mode take the list unchanged.

### Migration

On the first read, when `home` doesn't exist, it is created atomically
(`updateOne({_id:'home'}, {$setOnInsert}, {upsert:true})`) from `shoppingLists`:

- `items` = every item of every list (shared and personal), deduplicated by
  key, `qty` = the largest quantity seen, `name`/`w` from the most recently
  updated list, `addedBy` = that list's `createdBy`.
- `list` starts empty.
- `shoppingLists` is left untouched (rollback = revert the code). It is no
  longer read or written after this change.

## Pure module: `src/lib/shopping/home.ts` (import-free, unit-tested)

Replaces the list-shape parts of `lists.ts` (which keeps `normalizeQty`,
`MAX_QTY`, `KEY` — moved or re-exported, whichever keeps imports simplest).

- `parseItems(v)` / `parseList(v)` — validate a PATCH body (today's
  `parseItems` logic, with the two limits).
- `addToList(list, lines)` — idempotent per key: a line already on the list
  keeps its current quantity (it may have been edited for this shop); new
  lines are appended.
- `pickMissing(items, picks)` — `{key, qty}[]` from the "מה חסר?" sheet → list lines
  (name and `w` from the My item).
- `removeBought(list, ticked, notThere)` — drop ticked keys unless also in
  `notThere`.
- `homeFromLists(lists)` — the migration above.

## API

| Route | Does |
|---|---|
| `GET /api/shopping/home` | `{ items, list, updatedAt }` (creates/migrates on first call) |
| `PATCH /api/shopping/home` | body `{ items? , list? }` — replaces either array |
| `POST /api/shopping/home/list` | body `{ add: {key, qty}[] }` — the "מה חסר?" submit; merges with `addToList` |

All require the `shopping` permission (as the lists routes do). The old
`/api/shopping/lists` routes are deleted.

Trip end (`PATCH /api/shopping/trips/[id]` with `{ end }`): after `endTrip`, run
`removeBought` against `home.list` with the trip's `ticked` and `notThere`.
New trips store `listId: 'home'`; `getRecentTicked` is called with `['home']`
(old trips keep their old ids and simply stop counting).

## Page (`src/app/shopping/page.tsx`)

Removed: list chips, create/rename/delete list, the shared/personal toggle and
the `shopping:list` / `shopping:lists-cache` localStorage keys (a
`shopping:home-cache` replaces the cache).

Top of the page, in order:

1. **My items** — collapsible section ("המוצרים שלי · N"). Rows: photo, name,
   usual quantity stepper, remove. The existing search box and scanner add
   here (product window button becomes "+ למוצרים שלי"; already-saved shows
   "במוצרים שלי ✓").
2. **"מה חסר?"** — primary button. Opens a sheet:
   - My items as a checklist grouped by department (`d` on the item; items
     without one under "אחר"), items already on the list shown ticked and
     disabled.
   - Each row: tick, name, quantity stepper prefilled with the usual quantity.
   - A search field at the top: picking a result adds it to My items and ticks it.
   - "הוסף לרשימה (N)" posts to `/home/list` and closes.
3. **The list** — when it has lines: the lines (quantity editable, remove,
   "נקה רשימה" with a confirm), then everything below exactly as today
   (comparison, plans, per-item, "אני בסופר", manual prices, totals ⚙).
   When empty: a short empty state with the "מה חסר?" button instead of the
   comparison.

The comparison request is built from `home.list` instead of the selected list.

## In-store mode (`Here.tsx`, `/api/shopping/here`)

`mergeLists` gets one list (`[{ id: 'home', items: home.list }]`); the per-list
chips (`sh-here-lists`, the lists nav) are removed. "+ לרשימה" there adds to the
list (and to My items if new), same as the MCP add below.

## MCP tools (`src/lib/shopping/mcp-tools.ts`)

| Old | New |
|---|---|
| `shopping_lists`, `shopping_create_list` | removed |
| — | `shopping_my_items`: the household's My items |
| `shopping_get_list` (by id/name) | `shopping_get_list`: the one list (no arguments) |
| `shopping_add_items` (to a list) | adds to the list; a product not in My items is added there too, with that quantity as usual |
| `shopping_remove_items` | removes from the list |
| `shopping_compare` (by list) | compares the list |

`docs/shopping-api.md` is updated to match.

## Errors and edge cases

- Removing a My item doesn't touch the list (you may still need it this time).
- A My item whose product no longer has prices still shows; the comparison
  already reports items without prices.
- PATCH with an invalid line → 400 with the parser's message; the page shows
  "לא נשמר, נסו שוב" as today.
- Migration runs at most once (upsert with `$setOnInsert`); two first reads at
  once can't create two docs.

## Testing

- `src/lib/__tests__/shopping-home.test.ts`: `parseItems`/`parseList` limits,
  `addToList` idempotence, `pickMissing`, `removeBought` (ticked vs not-there),
  `homeFromLists` (dedupe, max qty, latest name).
- Existing trip/here/MCP tests updated for one list.
- Browser run-through on a local server: empty state → add products to My items
  → "מה חסר?" → comparison appears → start "אני בסופר", tick, mark one not
  there, end → ticked lines gone, not-there line remains.

## Out of scope

- Suggesting what's missing from purchase history.
- Per-person My items or multiple households.
