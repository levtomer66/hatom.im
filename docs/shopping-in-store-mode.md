# Shopping: plans and the in-store mode

Design for the next step of `/shopping`: choosing how to shop a list, then a
checklist to use inside the store. Agreed with the owner on 2026-11-17.

## The flow: three steps

The page becomes an explicit trip: **רשימה → השוואה → בחנות**.

| Step | What it is |
|---|---|
| רשימה | Building the list (today's list editor). |
| השוואה | The comparison, ending in a choice of **plan** and one primary button: **"יוצאים לקניות"**. |
| בחנות | A full-screen checklist for the chosen plan. It replaces the page until the trip ends or is left. |

On a phone, a small bottom bar shows the three steps. "יוצאים לקניות" is the
page's main button whenever the list is not empty.

## Plans

Two cards side by side, built from what the compare route already computes
(`rankStores` for one store, `bestSplits` for a split):

| | **הכי זול** | **חנות אחת** |
|---|---|---|
| What | Each item at its cheapest store | The cheapest store for the whole list |
| At most | **3 stores** | 1 store |
| Shows | Total, store count, **saving vs. the best single store**, extra walking | Total, the store, its walking time |

Rules:
- **Split only when it pays: at least ₪15** less than the best single store.
  Below that, the הכי זול card says "לא שווה לפצל" and points to the one-store plan.
- **Walking time** comes from the pins' routed walks (`places/walk.json`, the
  same router as the ingest's walk limit). Store-to-store legs aren't routed
  yet: show the sum of pin→store walks as an estimate.
- **Items the plan's store doesn't sell** (one-store plan): listed as
  "חסר כאן · ₪X ב-Y", with "add a stop" (turns it into a 2-store plan) or "skip".
- Deals count as today (`pricing.ts`); club and coupon offers stay offers.
- The full store ranking moves behind "כל החנויות" under the cards.

## The in-store screen

- **Grouped by store, then by department.** A split plan gets one tab per store,
  in walking order. Inside a store, departments in `DEPARTMENTS` order
  (`src/lib/shopping/departments.ts`), items without one under "אחר" last.
- **Big rows, one tap to tick.** A ticked item moves to the bottom of its
  department; every tick can be undone. A running total: "₪84 מתוך ₪132".
- **Screen stays on** (Wake Lock API) while the screen is open.
- **Works without signal:** the trip is cached when it starts and ticks are
  queued, then synced when back online.
- **Shopping together (first version):** two people on the same trip see each
  other's ticks. Poll the trip every ~5 s, only while the screen is open.
- **"לא היה"** on a row: suggests the cheapest item in the same department at
  this store whose name shares a word, or moves the item to the plan's next store.
- **Deal nudges:** "מבצע 3 ב-₪20 – יש לך 2, להוסיף עוד אחד?" from the promo
  labels the compare already returns.
- **End of trip:** "₪127 נאמד – כמה שילמת?" (optional), then the trip closes.
  Saves estimated vs. paid for a monthly savings line later.

## Departments (ingest side, done)

The price files have no category at all: all 12 ingested chains publish the same
regulated fields (name, maker, country, quantity, unit, price, unit price).
So each item doc gets `d` (a `DEPARTMENTS` id) at ingest:

1. **Wolt's category** for the barcode, when a venue sells it
   (`departmentOfCategory` on the path, e.g. "תה וקפה / קפה ושוקו" → coffee).
2. **Keyword rules on the name** (`departmentOf`): the longest matching stem
   wins; pets and baby get a bonus; one-letter Hebrew prefixes are ignored.
3. Nothing → no `d`; the UI shows "אחר".

Coverage (2026-11-17, 48.5k items): **78% of items, 90% weighted by how many
stores sell them** (the everyday items are the ones placed). Next layers, when
the misses show up on real lists:
- **A manual fix** in the app ("move to department…"), remembered for
  everyone: a small `shoppingItemDepartments` collection `{_id: itemKey, d, by, at}`
  read over the ingest's `d`.
- **AI labelling of the rest** at ingest, once per new item, cached.

## Learning a branch's aisle order

Each trip records the order items were ticked per store. After a few trips the
departments at that branch are shown in the learned order instead of the
default: per (store, department), the median position of its first tick.
Stored per store in a small `shoppingAisleOrder` doc; no personal data.

## Data model (new)

- `shoppingTrips`: `{ _id, listId, plan: 'cheapest' | 'one-store', stops:
  [{ storeKey, items: [itemKey] }], ticks: { [itemKey]: { by, at } },
  missing: [itemKey], estimate, paid?, startedBy, startedAt, endedAt? }`.
  One open trip per list; anyone who can see the list can join it.
- The list itself is unchanged; a trip snapshots the items and prices at start.

## Other modes (later)

- **Price check at the shelf:** scan a barcode in the store → "₪12.90 כאן ·
  ₪9.90 ברמי לוי". If the shelf price differs, one tap saves it (a manual price
  for neighbourhood shops, a "price reported" note for chains).
- **Staples ("השגרה"):** rebuild a list from the items of past trips.
- **Online order:** for an online-store plan, the list as a copyable text in
  that site's order.

## Order of work

1. Plans: the two cards + the ₪15 / 3-store rules on the compare result.
2. Trips: `shoppingTrips`, "יוצאים לקניות", the in-store screen grouped by `d`.
3. Shared trips (polling) and offline ticks.
4. "לא היה", deal nudges, end of trip.
5. Manual department fix; aisle-order learning.
