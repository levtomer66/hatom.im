# Coffee Order — design spec

**Date:** 2026-06-24
**Route:** `/coffee-order`
**Permission key:** `coffee-order`
**Status:** approved, ready for implementation plan

## Summary

A new permission-gated SPA feature modeled directly on `/spa`. A granted user
composes a coffee order, chooses "now" or a future scheduled time, and submits.
Submitting **fires an ntfy.sh push** (topic `hatomim_coffee`) so whoever is
making the coffee sees it instantly, and **saves the order to that user's
history**. Users can **save favorite orders** for one-tap reordering.

The feature is **hidden by default** — it only appears (home card, navbar entry,
route access) once an owner grants the `coffee-order` permission via
`/admin/allowlist`.

This mirrors the Spa feature end-to-end:
- Client-component page gated by `useSession()` + `hasPermission`.
- A form (segmented buttons, selects, `datetime-local`) that POSTs to an API route.
- A history list of past items, with delete.
- Native-driver "typed functions, not classes" Mongo models.
- A dedicated `*.css` file and a Hebrew page/nav title with English UI copy.
- A fire-and-forget ntfy.sh push on create, same shape as `notifySpaSchedule`.

## The order

| Field            | Options                                  | Default    | Control                       |
|------------------|------------------------------------------|------------|-------------------------------|
| **Drink**        | Espresso · Lungo · Cappuccino            | Cappuccino | segmented buttons             |
| **Milk**         | None · Regular · Soy · Lactose-free · Oat| Regular    | segmented buttons             |
| **Sugar**        | None · 1 · 2 · 3                          | None       | `<select>`                    |
| **Vanilla pumps**| integer 0–6                              | 0          | `−/+` stepper                 |
| **Caramel pumps**| integer 0–6                              | 0          | `−/+` stepper                 |
| **Notes**        | freeform text (≤ 500 chars)              | —          | `<textarea>`                  |
| **Delivery**     | "Now" / "Later"                          | Now        | toggle → `datetime-local` when Later |

Drink list is exactly the three the user specified; it is a single TypeScript
array constant and trivially extendable later. The pump cap of 6 and notes cap
of 500 are server-clamped.

## Data model

Two new Mongo collections, both using the native-driver "typed functions"
pattern (see `src/models/SpaSession.ts` / `src/models/CoffeeReview.ts` as the
template): one file per collection, a `get*Collection()` getter, a `docTo*`
mapper that turns `_id` into `id`, and `get*`/`create*`/`delete*` helpers. No
ODM wrapper, no Mongoose.

### `coffeeOrders`
```
CoffeeOrder {
  id: string;
  userEmail: string;          // from session, never the client
  userName: string;           // display name resolved server-side
  drink: CoffeeDrink;         // 'espresso' | 'lungo' | 'cappuccino'
  milk: CoffeeMilk;           // 'none' | 'regular' | 'soy' | 'lactose-free' | 'oat'
  sugar: CoffeeSugar;         // 'none' | '1' | '2' | '3'
  vanillaPumps: number;       // 0..6
  caramelPumps: number;       // 0..6
  notes: string;
  deliveryType: 'now' | 'scheduled';
  scheduledAt?: string;       // ISO 8601, present iff deliveryType === 'scheduled'
  createdAt: string;          // ISO 8601
}
```

### `coffeeFavorites`
```
CoffeeFavorite {
  id: string;
  userEmail: string;          // from session
  name: string;               // user-given label, e.g. "My morning"
  drink, milk, sugar, vanillaPumps, caramelPumps, notes;  // the saved drink config (no time)
  createdAt: string;
}
```

## Types (`src/types/coffee-order.ts`)

- `CoffeeDrink`, `CoffeeMilk`, `CoffeeSugar` string-literal union types.
- Option constants for the UI: `COFFEE_DRINKS`, `COFFEE_MILKS`, `COFFEE_SUGARS`
  (each `{ id, label, emoji? }[]`), plus `MAX_PUMPS = 6`.
- `CoffeeOrder`, `CoffeeFavorite` domain interfaces.
- `CreateCoffeeOrderDto` (no `id`/`userEmail`/`userName`/`createdAt`) and
  `CreateCoffeeFavoriteDto`.
- Validation/coercion helpers used by the API so client payloads can't smuggle
  bad values: `isValidDrink`, `isValidMilk`, `isValidSugar`, `clampPumps`,
  `orderSummaryLine(order)` for the ntfy body and the post-submit recap.

## API (`src/app/api/coffee-order/…`)

Every handler gates with `requirePagePermission('coffee-order')` and discriminates
on `gate instanceof NextResponse`. `userEmail` always comes from
`gate.session.user.email`. `params` is awaited (`await context.params`) per
Next.js 15.

- `GET  /api/coffee-order/orders` → the signed-in user's own orders, newest first.
- `POST /api/coffee-order/orders` → validate + clamp, create, fire ntfy, return 201.
- `DELETE /api/coffee-order/orders/[id]` → delete, but only if the doc's
  `userEmail` matches the caller (or the caller is an owner). 404/403 otherwise.
- `GET  /api/coffee-order/favorites` → the user's own favorites.
- `POST /api/coffee-order/favorites` → create (requires non-empty `name`).
- `DELETE /api/coffee-order/favorites/[id]` → delete own favorite (same ownership check).

### ntfy push (fire-and-forget, copy of `notifySpaSchedule`)
- Topic: `hatomim_coffee`.
- Title (ASCII only): `New coffee order: <userName>`.
- Body: drink + milk + sugar + pumps + delivery time + notes, e.g.
  ```
  Tomer
  Cappuccino · Oat milk · 1 sugar
  Vanilla x2
  When: now
  Notes: extra hot
  ```
- `.catch()` logs and never blocks the API response.
- `hatomim_coffee` must be added to the `connect-src` CSP allowlist in
  `next.config.js` **only if** `ntfy.sh` is not already allowed there. (The Spa
  and workout features already POST to `ntfy.sh`, so it is expected to be
  present already — verify and only touch CSP if missing.)

## UI (`src/app/coffee-order/page.tsx` + `coffee-order.css`)

Client component. Warm coffee palette (browns / cream / crema). English UI copy;
Hebrew page title in `layout.tsx` metadata and a Hebrew label on the home card +
navbar (same split the Spa page uses). Concrete Hebrew strings:
- Page/nav title (metadata + navbar label): `☕ הזמנת קפה`
- Home card title: `הזמנת קפה`
- Home card description: `הזמינו קפה — עכשיו או לעתיד`
- Home card linkText: `להזמנת קפה`

Gating fallback (covers soft-nav), identical shape to `family-tree/page.tsx`:
```ts
useEffect(() => {
  if (status === 'loading') return;
  if (!session?.user) { router.replace('/login?from=/coffee-order'); return; }
  if (!hasPermission(session, 'coffee-order')) router.replace('/');
}, [session, status, router]);
```

Two-column layout (mirrors Spa's `.spa-grid`):
- **Left — order form card.** Drink + milk segmented buttons, sugar select, two
  `−/+` pump steppers, notes textarea, a **Now / Later** segmented toggle that
  reveals a `datetime-local` (default: tomorrow 09:00 local) when "Later" is
  chosen. A **"Save as favorite"** action (prompts for a name, POSTs to
  `/favorites`). An **Order** submit button with a tidy "order placed" recap
  (drink summary + when). On success the new order is prepended to the history list.
- **Right — two stacked cards:**
  - **Favorites:** each favorite card shows its drink summary; tapping the card
    body loads the config into the form, and a **⚡ Order now** button places it
    immediately (`deliveryType: 'now'`) firing the push. Delete ✕ per favorite.
  - **Recent orders:** the user's order history, newest first, each with a
    cancel ✕ (DELETE). Scheduled orders show their formatted time; "now" orders
    show their `createdAt`.

## Permissions integration (the "no default visibility" requirement)

One new key, `coffee-order`, wired into the five places the app already keys off
permission keys:

1. **`src/types/permissions.ts`** — add `'coffee-order'` to the `PermissionKey`
   union, to the `PERMISSION_KEYS` array (placed near the `mekafkefim` group),
   and to the `PERMISSIONS` meta map: `{ label: 'Coffee Order', emoji: '☕' }`.
   The admin matrix at `/admin/allowlist` renders the new toggle automatically.
2. **`src/middleware.ts`** — add
   `{ pattern: /^\/coffee-order(?:\/|$)/, permission: 'coffee-order' }` to `GATES`.
3. **`src/app/page.tsx`** — add a `Feature` to `allFeatures`:
   `{ icon: FaMugHot, title: 'הזמנת קפה', description: 'הזמינו קפה — עכשיו או לעתיד', href: '/coffee-order', linkText: 'להזמנת קפה', permission: 'coffee-order' }`
   (import `FaMugHot` from `react-icons/fa`). The home grid filters on
   `hasPermission`, so it shows only when granted.
4. **`src/components/Navbar.tsx`** — add a nav item with
   `visibility: { permission: 'coffee-order' }` (match the existing nav-item
   shape after reading the file).
5. **The page itself** — the client-side `hasPermission` redirect fallback above.

A single key (no separate `:write`) is sufficient: ordering *is* the write, and
the same person who can see the page is the one who orders — identical to how
`spa` uses one key for both read and write.

## New files

```
src/types/coffee-order.ts                        # types + DTOs + validation + option constants
src/models/CoffeeOrder.ts                         # coffeeOrders CRUD (native-driver typed functions)
src/models/CoffeeFavorite.ts                      # coffeeFavorites CRUD
src/app/coffee-order/page.tsx                     # the SPA page (client component)
src/app/coffee-order/layout.tsx                   # metadata title (Hebrew)
src/app/coffee-order/coffee-order.css             # styles
src/app/api/coffee-order/orders/route.ts          # GET, POST
src/app/api/coffee-order/orders/[id]/route.ts     # DELETE
src/app/api/coffee-order/favorites/route.ts       # GET, POST
src/app/api/coffee-order/favorites/[id]/route.ts  # DELETE
```

Edited shared files: `src/types/permissions.ts`, `src/middleware.ts`,
`src/app/page.tsx`, `src/components/Navbar.tsx`, and `next.config.js` *only if*
`ntfy.sh` is missing from the CSP `connect-src`.

## Out of scope (YAGNI for v1)

- Order status / fulfillment tracking (pending → done). Orders are a log + push,
  like Spa sessions.
- A shared "barista queue" view of everyone's orders — the push covers that;
  history is per-user.
- Editing an existing order (delete + re-create instead).
- Full i18n dictionary — UI copy is static English like the Spa page.

## Verification

- `npx tsc --noEmit --incremental false --pretty false`
- `npm run lint`
- `npm run build`
- Manual: grant `coffee-order` to a test user; confirm the home card + navbar
  appear only when granted, the route 302s to `/` without the grant, an order
  POST persists + fires the push, favorites save/load/quick-order, and delete works.

## Shipping

Open a PR to `origin` for the user to merge. **No Vercel CLI / deploy operations**
(explicit constraint this session).
