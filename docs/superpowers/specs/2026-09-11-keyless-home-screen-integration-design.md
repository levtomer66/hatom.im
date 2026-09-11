# Keyless Home-Screen & AI Integration — Design

**Date:** 2026-09-11
**Status:** Approved (Phase 1)

## Goal

Let users drive hatom.im features from **iPhone home-screen buttons**, **macOS
apps**, and **AI (MCP)** — with as little friction as possible and **no custom
API key**. Authentication reuses what already exists (the Google session) plus,
for OAuth-capable native clients, a Google ID token. Phase 1 delivers the
flagship: a **one-tap "order my favorite coffee" button** on the iPhone home
screen.

## How we got here (grilling record)

This design replaces an earlier personal-API-key + Shortcuts plan that was
explored and **rejected**. Two findings killed it:

1. **iOS rejects unsigned `.shortcut` files** ("Importing unsigned shortcut
   files is not supported"). A spike confirmed our server-generated plist was
   *valid* (iOS recognized it as a shortcut) but refused it for lacking a
   signature; `shortcuts sign` is macOS-only, so a Vercel/Linux server can
   never produce an installable shortcut.
2. A Shortcut's headless `Get Contents of URL` runs in **its own cookie jar**,
   so it can't reuse the site session; only `Open URL` (a visible Safari
   launch) carries the login. That means the *only* thing a custom API key
   would have bought us — silent background automations — and we chose to
   **drop the key** and forgo silent automations rather than manage a
   long-lived secret in a between-friends app.

## Decisions (locked with the user)

1. **Keyless.** No `apiKeys` collection, no encryption, no key-reveal profile,
   no `requireApiCaller`. Authentication is exactly two mechanisms:
   - **Session cookie** — browsers *and* PWA home-screen pages (already exists:
     `requireSignedIn` / `requirePagePermission`).
   - **Google ID token as Bearer** — for OAuth-capable native clients (macOS
     app; later MCP). A server gate validates the Google JWT (JWKS signature,
     `aud` = our client id, `exp`), maps `email` → allowlist/permission. **Not
     built in Phase 1** — added when the macOS app is reworked.
2. **iPhone home-screen button = PWA.** Every feature already has an
   `apple-icon.tsx` + `icon.svg`, so "Add to Home Screen" already yields an
   icon that opens the session-authed page. We add `appleWebApp` metadata so it
   opens **standalone** (chrome-less), and — for parameterless actions — a
   **fire-on-load quick page**.
3. **Coffee is the flagship.** `/coffee-order/quick/[favoriteId]` places the
   favorite's order on load and shows a confirmation. Adding *that* page to the
   home screen is the one-tap button. This proves the whole pattern end-to-end
   on the user's iPhone with zero new auth.
4. **No silent iOS automations.** Accepted tradeoff of keyless. Paging (which
   needs a typed message) stays the existing `/paging` form; a preset one-tap
   page is possible later.
5. **The macOS app rework is out of scope here.** It lives in its own repo.
   Phase 2 adds only the server-side Google-token gate it will call. The
   current static paging token (`PAGING_SHORTCUT_TOKEN` / `PAGING_SHORTCUT_EMAIL`
   / `paging-shortcut-auth.ts`) **stays alive** until that rework lands — we do
   **not** hard-cut it in this project.
6. **Identity = the Auth.js session**, exactly as every other feature. The
   quick endpoint derives the ordering email server-side; any client-supplied
   identity is ignored.

## Architecture (Phase 1)

Entirely within the existing Next.js app; no new collections, no new env vars,
no CSP change (same-origin `fetch`, ntfy.sh already allowlisted).

### Data flow — the coffee one-tap

```
Home-screen icon (added from /coffee-order/quick/<favId>)
  → opens standalone PWA at /coffee-order/quick/<favId>  (session cookie sent)
  → page mounts, POSTs once to /api/coffee-order/orders/from-favorite/<favId>
  → endpoint: session-gate → load favorite (must belong to caller, or caller is
    owner) → build CreateCoffeeOrderDto from the favorite's stored config →
    createCoffeeOrder(...) → after() ntfy push to hatomim_coffee
  → page shows "✅ הוזמן: <drinkSummary>"  +  [הזמן שוב] button
```

### Components / files

**New — server:**
- `src/models/CoffeeFavorite.ts` — add `getCoffeeFavoriteById(id): Promise<CoffeeFavorite | null>`
  (there is currently no by-id read; the quick endpoint needs one).
- `src/app/api/coffee-order/orders/from-favorite/[favoriteId]/route.ts` —
  `POST`. Session-gated via `requirePagePermission('coffee-order')`. Loads the
  favorite; authorizes it (`favorite.userEmail === caller` **or**
  `isOwnerEmail(caller)`); maps its `CoffeeDrinkConfig` + `deliveryType` into a
  `CreateCoffeeOrderDto`; reuses the **same** order-creation + `after()` ntfy
  notification as the existing `POST /api/coffee-order/orders` (extract the
  shared `notifyCoffeeOrder` helper so there is one push implementation, not
  two — see Standards note). `deliveryType` is forced to `'now'` for a one-tap
  order (a scheduled favorite still orders "now" when tapped; scheduling needs
  a UI). Returns the created `CoffeeOrder` (201) or a JSON error.

**New — client:**
- `src/app/coffee-order/quick/[favoriteId]/page.tsx` — `'use client'`. On mount,
  a **single-shot** POST (guarded by a `useRef` so React's dev double-mount and
  re-renders can't double-order). States: *ordering…* / *success* (shows
  `drinkSummary` + an "order again" button that re-fires) / *error* (shows the
  message + retry). Its `metadata` (via a colocated server wrapper or route
  segment config) sets `appleWebApp` so it installs standalone; the coffee
  `apple-icon` is already the home-screen glyph.
- `src/app/coffee-order/quick/[favoriteId]/quick.css` — minimal full-screen
  centered confirmation styling (large check, drink summary, one button).

**Modified:**
- `src/app/coffee-order/page.tsx` — on each saved favorite add a small
  **"📲 כפתור מסך בית"** affordance that navigates to that favorite's quick
  page, plus a one-line hint: *"בעמוד: שיתוף → הוספה למסך הבית"* (iOS can't add
  to the home screen programmatically, so we route the user to the page and
  they use the Share sheet). Reuses existing favorites list markup.
- `src/app/layout.tsx` **or** the coffee route metadata — add `appleWebApp`
  (`capable: true`, a Hebrew `title`, `statusBarStyle: 'black-translucent'`) so
  installed pages open standalone. Prefer per-route metadata over global to
  avoid changing the status bar for the whole site at once.

### Authorization

The quick endpoint is **session-gated** and re-checks ownership of the favorite.
A favorite ordered by anyone other than its owner is refused (`404`), except
site owners (Tom/Tomer), mirroring `deleteCoffeeFavorite`'s owner rule. No
endpoint trusts a client-supplied email.

### Error handling

- Favorite missing / not owned → `404`, page shows "המועדף לא נמצא".
- Invalid stored config (shouldn't happen; favorites are validated on create) →
  the same validation the order route uses; on failure `400`, page shows the
  message.
- ntfy failure is swallowed inside `after()` (as today) and never fails the
  order.
- Not signed in → middleware/route returns `401`/redirect; the standalone PWA
  shows the login page (one-time Google sign-in inside the web app container).

## Testing

- **Pure unit (node:test):** the favorite→`CreateCoffeeOrderDto` mapping is a
  pure function in `src/types/coffee-order.ts` (import-free, testable via a
  relative `.ts` import) — assert every `CoffeeDrinkConfig` field is carried
  over and `deliveryType` is forced to `'now'`.
- **Build/tsc/lint** clean.
- **Manual (user's iPhone):** create a favorite → open its quick page → confirm
  the order lands on the board + ntfy push arrives → Add to Home Screen →
  relaunch from the icon → confirm it opens standalone and re-orders. This is
  the acceptance test for the whole phase.

## Roadmap (each its own spec/plan later)

- **Phase 2 — Google-token gate + pager keyless migration.** Add
  `src/lib/google-token-auth.ts` (verify Google ID token → email → permission),
  let `/api/paging/pages` accept session **or** Google-token Bearer, coordinate
  dropping the static token with the external macOS-app rework. Phone paging
  meanwhile is the existing `/paging` form added to the home screen.
- **Phase 3 — quick-page fan-out.** Preset paging pages, todo "quick add",
  spa quick actions — same PWA pattern.
- **Phase 4 — MCP.** Remote HTTP MCP at `/api/mcp`, OAuth-authed; tools wrap the
  feature APIs (photo→todo, "order my coffee", "book a spa session"). The
  OAuth authorization-server design is grilled when we reach it.

## Explicitly out of scope

- Any custom API key, key storage, key-reveal profile page.
- Silent background iOS automations (Shortcuts triggered by time/NFC/location).
- The macOS app's internal rework (separate repo).
- Server-side shortcut generation of any kind.
- Rate-limiting / quotas — handful of trusted allowlisted users.
