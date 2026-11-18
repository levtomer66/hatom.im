# Orientation for Claude Code sessions on `hatom.im-next`

This file is for future Claude instances working on this repo. Skim it before
the first tool call; the rest of the repo is self-explanatory once you have
this context.

## What this repo is

One Next.js 15 (App Router) app served at `https://www.hatom.im`. It hosts
several independent features under separate routes:

| Route              | Feature                                        |
|--------------------|------------------------------------------------|
| `/workout`         | Main feature. Workout tracker, i18n EN/HE + RTL, drag-and-drop reorder, YouTube/IG exercise links, feedback FAB → ntfy.sh. |
| `/trip.html`       | **Static HTML** (not a Next route). Trip itinerary for USA + Mexico 2026: progress bar, calendar, Leaflet map, and an admin journey flow (photo upload with EXIF auto-routing → Vercel Blob). |
| `/mekafkefim`      | Coffee reviews with two reviewers (Tom, Tomer) and an optional pasted photo URL. |
| `/instomit`        | Video wall with comments + likes.              |
| `/family-tree`     | Tree visualisation (react-d3-tree).            |
| `/greeting`        | Small greeting page.                           |
| `/birthday-quiz`   | Host-driven Hebrew family quiz (permission `birthday-quiz`). Questions + pure reducer in `src/lib/birthday-quiz.ts`. |
| `/laundry`         | Step-by-step laundry guide for our LG washer (permission `laundry`). Loads, doses + step builder in `src/lib/laundry.ts`; photos in `public/laundry/`. |
| `/calendar`        | Milestones calendar: birthdays, anniversaries, one-off events (permission `calendar`). Mongo `calendarEvents`; date math in `src/lib/calendar.ts`. |
| `/shopping`        | Grocery price comparison across chains (permission `shopping`). Household My items + one list in Mongo `shoppingHome`. price data written by a local ingest job. |

Default branch is `main`. Pushes to `main` auto-deploy to Production via
Vercel's GitHub integration. There is no separate `master` branch.

## Key conventions

- **Typed functions, not classes** for Mongo models. See
  `src/models/CoffeeReview.ts` and `src/models/TripJourney.ts` for the pattern:
  one file per collection, exports `get*`/`create*`/`update*`/`delete*`
  helpers, no ODM wrapper.
- **Route handlers** live at `src/app/api/<segment>/route.ts` and export
  `GET` / `POST` / `PATCH` / `DELETE` functions from `NextRequest` →
  `NextResponse`.
- **Workout i18n**: UI copy goes in `src/lib/workout-i18n.ts` as a flat
  TypeScript-typed dictionary, consumed via `useT()`. Exercise translations
  live in `src/lib/exercise-translations/<lang>.ts` and fall back to the
  English `name`/`description` on the `ExerciseDefinition`. Adding a new
  language = one new file + one line in `src/lib/exercise-translations/index.ts`.
- **`public/trip.html` is standalone static HTML**. It cannot import from
  `src/` because it is not bundled by Next. Client deps for the trip page
  load via `<script src="https://unpkg.com/...">`; `unpkg.com` is already on
  the CSP allowlist in `next.config.js`.
- **CSP**: defined in `next.config.js`. Lives under `async headers()`. Be
  careful when adding new external origins — the site has strict CSP and
  past incidents blocked features in production.
- **Never amend a commit that's already on `origin`** — always follow up.
- **Pre-commit hook** (Husky) runs `npm test` then `next build`. A failed
  test or build blocks the commit. If the Next cache seems stuck (e.g. `Cannot find module for page:
  /_document`), `rm -rf .next` and retry — this has happened twice.

## Running things

```bash
# dev server (picks next available port; usually :3000)
npm run dev

# local mode: no Google sign-in — gated pages sign you in as an owner.
# Uses LOCAL_MONGODB_URI (default: the Docker test Mongo on :27018), never
# .env.local's MONGODB_URI. Guarded by NODE_ENV=development + localhost.
npm run dev:local -- -p 3100

# verify before commit
npx tsc --noEmit --incremental false --pretty false
npm run lint
npm run build

# unit tests for the pure workout helpers (node:test, no extra deps)
npm test
```

Tests live in `src/lib/__tests__/*.test.ts` and import the module under test
with an explicit `.ts` extension (Node's type-stripping needs it; tsconfig has
`allowImportingTsExtensions`). Only import-free modules are testable this way
— path aliases (`@/…`) don't resolve under Node.

## Shipping

The project-level slash command is the blessed path:

```
/ship                         # commit message auto-generated
/ship "scope: short subject"  # custom subject
```

`/ship` implements the full loop: git state probe → verify (tsc + lint + build)
→ commit → `/code-review` (the built-in skill, run against `origin/main`; two
parallel axes, Standards + Spec) → apply findings (you triage severity — there
is no P0–P3 labelling) → push (fast-forward only; asks before force-pushing).
Source: `.claude/commands/ship.md`.

## Environment

`.env.local` is gitignored. To populate it:

```bash
vercel login                          # one-time per machine
vercel link --yes --project hatom-im  # one-time per clone
vercel env pull .env.local            # anytime thereafter
```

Vars the app expects:

| Var                     | Used by                                    |
|-------------------------|--------------------------------------------|
| `MONGODB_URI`           | Every API route (via `src/lib/mongodb.ts`). |
| `BLOB_READ_WRITE_TOKEN` | `/api/trip/journey/upload` via `@vercel/blob`. |
| `AUTH_SECRET`           | Auth.js session encryption — `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID`        | Google OAuth client id. |
| `AUTH_GOOGLE_SECRET`    | Google OAuth client secret. |
| `AUTH_URL`              | Required in production only (`https://www.hatom.im`). Auth.js auto-detects in dev and on Vercel previews. |

## Auth (Google SSO)

The site uses **Auth.js v5** (`next-auth@5`) with the Google provider and the
`@auth/mongodb-adapter`. Source of truth: `src/auth.ts` re-exports
`{ handlers, auth, signIn, signOut }`. Every page can call
`const session = await auth()` server-side; client components use
`useSession()` via the `SessionProvider` mounted in `src/app/layout.tsx`.

Identity = Gmail address. Two roles:

- **owner** — `tomzari347@gmail.com` (Tom) or `levtomer66@gmail.com` (Tomer).
  Source: `src/types/auth.ts` `OWNER_EMAILS`.
- **allowlisted** — any email present in the Mongo `authorizedEmails`
  collection (introduced in PR 2 of the SSO rollout).

### Google Cloud Console one-time setup

1. Create an OAuth 2.0 Client ID, type = Web application, in your Google Cloud project.
2. Authorized JavaScript origins:
   - `https://www.hatom.im`
   - `http://localhost:3000`
3. Authorized redirect URIs:
   - `https://www.hatom.im/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
   - Plus the preview pattern, or add each preview URL on demand.
4. Paste the client ID + secret into Vercel env (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`)
   for Preview + Production. Generate `AUTH_SECRET` with `openssl rand -base64 32`.
   Set `AUTH_URL` to `https://www.hatom.im` on Production only.

## Vercel CLI gotchas

- Adding a **preview-scope** env var from a non-TTY context needs
  `vercel env add NAME preview "" --value "$V" --yes --force` — the empty
  string means "all preview branches". Without the empty branch arg the CLI
  hangs or errors with `git_branch_required`.
- Creating a Blob store via `vercel blob create-store <name> --access public`
  is interactive unless you add `--yes`, which auto-links to all three
  environments and provisions `BLOB_READ_WRITE_TOKEN` as an env var.
- `vercel env pull .env.local` also drops `VERCEL_OIDC_TOKEN` into the file.
  App code does not read it; it's a CLI artefact.

## Feature-specific notes

### Workout (`/workout`)

- Data model: `WorkoutTemplate` (with `exercises: TemplateExercise[]`),
  `Workout` (with an `order` field on each exercise), `CustomExercise` (user-
  added exercises).
- Legacy-shape templates still in Mongo store `exerciseIds: string[]` — the
  API handlers transparently convert on read (`src/app/api/workout/templates/
  route.ts`). Don't remove that fallback without migrating the documents.
- **Identity = session email** (post-SSO migration): `UserId` is the user's
  Gmail address, derived server-side from the Auth.js session in every
  workout API route (`requireSignedIn()`; any client-supplied userId is
  ignored). `KNOWN_USERS` in `src/types/workout.ts` maps the three historic
  emails to display names (Tom, Tomer, Amit); any other allowlisted email is
  a valid user whose name falls back via `getUserDisplayName()`. The old
  fixed IDs `tom`/`tomer`/`amit` no longer exist.
- **Freestyle workouts**: "Start Empty Workout" creates a workout named
  `FREESTYLE_WORKOUT_NAME` with `templateId: null` — that null IS the
  freestyle marker (template-started workouts always carry a templateId).
  On completion the summary offers "save as template" via
  `templateExercisesFromWorkout()`; saving renames + links the workout.
- **The Moving Car** (feed): derived purely from the sum of all feed posts'
  `stats.totalVolumeKg` by `computeCarState()` in `src/lib/workout-car.ts`
  (1 000 kg = 1 m; level 1 = 50 m, ×1.25 per level). Nothing is stored —
  don't add a level document; change the constants instead.
- **History weeks**: Sun–Sat inside calendar months, grouped by
  `src/lib/workout-weeks.ts`. A week straddling two months appears in both,
  clipped to each month's days (`rangeStart`/`rangeEnd`, `partial: true`).
  Parse `YYYY-MM-DD` with `parseLocalDate()`, not `new Date(str)` (UTC) —
  `formatDate()` already does this for bare date strings.
- Alias collision bug fixed once: `lat-pulldown` → `wide-grip-lat-pulldown`.
  Template read/write goes through `resolveExerciseId()` + dedupe helper so
  templates can't hold both forms at once. Don't regress.
- Full RTL flip when language is `he`. `.workout-app { text-align: start }`
  is load-bearing — it prevents the site-global `html[dir="rtl"]` rule from
  leaking `text-align: right` into English mode. See `workout.css` comment.

### Trip journey (`/trip.html`)

- Storage: Mongo `tripJourney` collection (one doc per day keyed by
  `YYYY-MM-DD`) + Vercel Blob for photos.
- Photos are resized **client-side** to ≈500 KB (2000 px long edge, JPEG
  quality 0.82) before upload. EXIF is parsed *before* resize and sent as
  form fields; the shipped JPEG has no metadata. This keeps us inside the
  Hobby-tier Blob quota (≈1 GB).
- Photos whose EXIF date can't be resolved land in a reserved `__unassigned__`
  day doc — there's an admin UI to reassign them.
- Admin mode is `?admin=1` + a token stored in `localStorage` — there is no
  OAuth. All `/api/trip/journey/*` writes require the `X-Admin-Token` header.

### Coffee reviews (`/mekafkefim`)

- Photos are a single optional `photoUrl` string on the review
  (`src/types/coffee.ts`) — the Add/Edit forms take a pasted external image
  URL; nothing is uploaded or stored in Mongo (no base64, no Blob), so the
  docs stay tiny (~0.5 KB) and there is no image-serving route. If you ever
  add real photo *upload*, follow the trip-journey Blob pattern (upload to
  Vercel Blob, store only the ref) — don't put bytes in the document.
- **Scoring has one source of truth**: `scoreReview()` in `src/types/coffee.ts`,
  used by the API sort, the list page and the card. It replaced three
  implementations that disagreed (two `nonZeroAvg` copies plus a naive `/4`
  API sort that counted zeros). Don't add a fourth.
- Two distinct blank states, and the card renders them differently: a rating
  of `0` means *not rated yet* (`—`), while a category listed in the place's
  `disabledCategories` means *not measured here* (`אין`) — the café has no
  kitchen. Both are excluded from the averages.
- Disabling a category **never clears the stored ratings** — they're ignored,
  so un-ticking restores the old score. Don't "tidy up" by zeroing them.
- `COFFEE_CATEGORIES` in `src/types/coffee.ts` is the registry both forms and
  the card map over. A new category is one entry there plus two fields on
  `CoffeeReviewRatings` — not four more hand-written slider blocks.
- `src/types/coffee.ts` must stay **import-free**:
  `src/lib/__tests__/coffee-score.test.ts` imports it via a relative `.ts`
  path for `node --test`, which can't resolve the `@/…` alias.
- `ScaleBar` is `min="1"` on purpose (`src/components/RatingStars.tsx`). A
  rating can't be un-set by dragging; per-place disabling is the intended way
  to take a category out of the score.

### Laundry (`/laundry`)

- Doses, temps and spins are transcribed from the handwritten notes on the
  laundry-room door. Keep the measures verbatim (פקק ורוד – 80 מ״ל, פקק קטן,
  חצי כוס שקופה) — they are the real cups on the shelf. The notes don't name a
  program; Cotton vs Mixed Fabric per load was the owner's call.
- Step photos are just two shots (`drawer.jpg`, `panel.jpg`). Each step zooms
  onto a point via `focusFrame()` and draws a spotlight marker; points live in
  `SPOTS` as fractions of the photo, so re-shooting a photo = re-measuring
  those fractions and the aspect in `PHOTOS`.
- Photos are plain `<img>` under the gated `/laundry` prefix — the Next image
  optimizer fetches without the session cookie and would get the login redirect.

### Calendar (`/calendar`)

- Events are bare `YYYY-MM-DD` days in Mongo `calendarEvents`. Birthdays and
  anniversaries recur yearly (Feb 29 → Feb 28 in common years); `event` is
  one-off. All date math is in `src/lib/calendar.ts` on UTC midnights —
  "today" is the viewer's local day, computed client-side after mount.
- `SEED_EVENTS` (first date, wedding, both birthdays) is inserted exactly once,
  guarded by an atomic marker doc in `calendarMeta`. Deleting a seeded event
  keeps it deleted; to re-seed, bump `SEED_MARKER_ID` in the model.
- Anyone with the `calendar` permission can add, edit and delete — there's no
  per-event owner (`createdBy` is informational).

### Shopping price comparison (`/shopping`)

- Sources per chain, access methods and verification notes: `docs/sources.md`.
  Official price-transparency files first; **Wolt** is an approved additional
  source for small shops (`chainId: 'wolt'`, delivery prices — label them).
  Never comparison sites.
- **Pins** (`places/pins.json` in the cache dir, personal — never in the repo)
  drive `npm run shopping:discover` (small-shop discovery, OSM + hand-collected
  Google Maps lists) and limit the ingest to stores near them
  (`ingest/locate.ts`; `--all-stores` to keep whole cities). A pin's
  `walkMinutes` limits stores to a routed walking time (`ingest/walk.ts`);
  `places/extra.json` adds shops the map searches miss, and `places/official.json`
  hand-matches a shop to an official store whose address doesn't match
  (`"<placeRef>": "<chainSlug>/<storeId>"`). An official store matched to a shop
  the owner skipped is left out, like an included one is kept, without re-routing.
- **Ingest is a local, manually-run job**, not a Vercel function (Hobby cron
  is daily-only and a full run is ~190 MB of downloads + GBs of XML):
  `npm run shopping:ingest -- [--dry-run] [--offline] [--chains yohananof,shufersal,wolt] [--max-stores N] [--full] [--all-stores]`.
  `--offline` rebuilds the docs from saved state without fetching. Test locally
  against Docker Mongo with a *copy* of the cache (`SHOPPING_CACHE_DIR`), or
  its `written.json` will make the next Atlas run skip docs.
  Needs a write-capable `MONGODB_URI` in `.env.shopping` (gitignored).
  Cache in `~/.cache/hatom-shopping` (raw files pruned after 7 days and never
  re-downloaded; per-store parsed state; `written.json` hashes). Not in the
  repo: writes under the repo root trigger the `next dev` recompile loop.
- **Mongo M0 budget drives the schema** (512 MB incl. indexes, ~100 ops/s):
  `shoppingItems` is one doc per item with a `p: {storeKey: agorot}` map
  (barcode `_id`; chain-internal codes are `<chainId>:<code>` and never
  cross-match); `shoppingPromos` is one doc per `(chain, PromotionID, terms)` with a
  `stores` list and a multikey `items` index — the same PromotionID differs per
  store (item lists, per-store percent prices); see `buildPromoDocs` for why
  item lists are unioned and rate-derived prices dropped. The job writes only docs whose
  content hash changed. Don't switch to a doc per (store, item) — that's ~3M
  docs and hours of writes.
- `src/lib/shopping/*.ts` (xml, normalize, cities, snapshot, chains) are
  import-free for `node --test`; fixtures from 2026-11-15 in
  `src/lib/__tests__/fixtures/shopping/` hold the Yochananof regression case.
- Promo semantics: `DiscountedPrice` is the **total for `MinQty` units**;
  `RewardType` codes differ per chain; `MinNoOfItemOffered` is kept as
  `minItems` but is 10 on ~99% of promos, so don't treat it as a quantity.
  Only the daily *Full* files are ingested — the hourly `Price`/`Promo`
  deltas are ignored (fine for a once-a-day manual run). Online stores
  (`StoreType` 2) are ingested whatever their city, with `city: null`. City = CBS code first, store name only when City is 0 —
  never the address (see docs/sources.md § City matching).
- **Basket pricing** is `src/lib/shopping/pricing.ts` (pure; the header
  comment says how each promo shape is read). `price` = total for `min`
  units and wins over `rate`; weighted min 0.01 = per kg; a gift part (price 0
  / rate 100) makes the promo buy-X-get-Y, and so do parts under a second
  `gid` ("השני ב-20": the first gid is the buy part, its prices informational —
  never price one unit at the reward). Promos are applied greedily, the
  biggest saving first, and a unit counts toward one promo only. Club, coupon
  and unmet basket-minimum promos are returned as `offers`, not applied.
  Description-only deals are not parsed.
- **Photos**: the priced source's own (Wolt), else by barcode from Rami Levy's
  image CDN, a photo-only Wolt venue or Open Food Facts (`imgBy: 'off'` —
  credit OFF), else borrowed by name (`imgBy: 'name'`, `photos.ts`). The
  barcode sources are probed by `npm run shopping:photos` into `photos/*.json`;
  the ingest only reads them. Details: docs/sources.md § Product photos.
- **Departments**: the price files carry no category, so each item doc gets
  `d` at ingest (`src/lib/shopping/departments.ts`, import-free): Wolt's category
  path for the barcode first, else keyword rules on the name (longest stem wins).
  ~78% of items are placed. The in-store mode built on it: `docs/shopping-in-store-mode.md`.
- **API and MCP**: `docs/shopping-api.md`. The search, item and compare routes
  and the MCP tools (`src/lib/shopping/mcp-tools.ts`) share one set of queries,
  `src/lib/shopping/service.ts` — change pricing there, not in a route. Tools
  take a free-text product (best search match, runner-ups named) and an
  optional `city` that falls back to the user's saved `settings.city`.
- **UI** at `SHOPPING_BASE_PATH` (`src/lib/shopping/config.ts`; the middleware
  `matcher` literal must move with it). There are no named lists: one
  household doc (`shoppingHome`, `_id: 'home'`, model `src/models/ShoppingHome.ts`,
  pure rules in `src/lib/shopping/home.ts`) holds **My items** (usual products
  with a usual quantity; search, scan and the product window save there) and
  the **one shopping list**, filled from My items by "מה חסר?". Everyone with
  `shopping` shares both. Ending a trip `$pull`s the ticked lines (not-there
  ones stay); every trip has `listId: 'home'`. The doc is built once from the
  old `shoppingLists` (left untouched, read only by that migration).
  Spec: `docs/superpowers/specs/2026-11-18-shopping-my-items-design.md`.
- **Favorite stores** (`shoppingHome.favStores`, store keys, max 10, the
  household's): ☆/★ on every store row; favorites first in distance-sorted
  lists (`sortStores(…, favs)`), price rankings keep their order. A far store
  is a regular store: the owner adds it via `places/extra.json` + the
  discovery review (the ingest keeps a curated store in any target city, pin
  or no pin — `keepRule` in `ingest/locate.ts`); a city added only for that
  sets `picker: false` in `CITIES`. `GET /api/shopping/stores?q=` searches every
  priced store in every city; `POST /api/shopping/far` (the page sends its favorites) prices the list at the
  favorites ("כמה יעלה לי ב…", from the list card). Plans and compare stay on
  the user's city; `/here?store=` compares a store with its own city.
  Spec: `docs/superpowers/specs/2026-11-18-shopping-favorite-stores-design.md`.
  `/api/shopping/compare` loads only the
  basket items, their promos (`items` index) and the city's stores, then runs
  `rankStores` and the plans in the request. Physical and online stores are
  ranked separately; stores whose `pricesAt` is null are never shown.
  The read model is `src/models/ShoppingCatalog.ts`; the app never writes the
  ingest collections.
- **Result views**: the plan cards ("הכי זול" / "חנות אחת"), then "כל החנויות"
  on one page: physical stores ranked for the whole list, online, the stores
  priced by hand. Every price carries
  its source (`StoreInfo.source`, from `priceSourceOf` in `collections.ts`: official / wolt /
  manual), rendered only by `<SourceBadge>`. Search is in `src/lib/shopping/search-rank.ts`: `searchPatterns()` turns
  each word into a spelling-tolerant regex (optional ו/י, final letters, ה/א
  endings, quotes; a one-typo variant for the retry the route makes under 8
  hits), matched against the name, the maker `m` and `s` (all chains' names
  and makers, when the ingest writes it). Ranking: words matched as typed,
  then name-match position, then store count.
- **Atlas Search** (`items_search` on shoppingItems; definition and query in
  `src/lib/shopping/search-index.ts`): the search route asks it for ~100
  fuzzy candidates, then ranks them with rankHits as above; no retry pass.
  Where `$search` fails (Docker Mongo, index missing) it falls back to the
  regex search and skips Atlas for 5 minutes. Create the index on a new
  cluster with `npm run shopping:search-index` (`-- --show` to inspect).
- **Plans and trips** (docs/shopping-in-store-mode.md): the compare route
  returns `plans` (one store, and `byCount`: the cheapest over exactly 2
  and 3 stores via `choosePlan` in `plans.ts`, each stop re-priced).
  `worthCount` picks the default: each extra store must cover more items or
  save ₪15 over one store fewer. The "הכי זול" card's 2 · 3 chips switch
  between them on the client (last pick in localStorage).
  "יוצאים לקניות" starts a trip (`shoppingTrips`, model ShoppingTrip, rules in
  `trips.ts`): one open trip per list, a snapshot of the plan's items with
  department `d`, reachable by whoever can see the list. The in-store screen
  polls every 5 s while visible; ticks made offline wait in localStorage and
  `withPending` keeps unanswered taps from being undone. Swaps and moves
  rewrite `stops` with a `rev` check. "לא היה" suggestions come from
  `/api/shopping/alternatives` (same department, shared word, cheapest).
  Neighbourhood shops are priced by hand in <ManualPrices> (one PUT to
  `/api/shopping/manual-prices` per field, then a re-compare); the contract
  is in the header comment of `src/app/shopping/page.tsx`.
- **One product** (`GET /api/shopping/item?key&city`, the eye button and the
  camera scanner): one unit priced at every store in the city with promos,
  manual prices included. A one-unit price is always per unit: a multi-buy
  ("2 ב-10") counts at its per-unit price with an asterisk, its terms on
  hover/tap (`shownUnit`/`multiBuyUnit`) — product view, search, "אני בסופר". A scanned code is tried as-is and without leading
  zeros. `Scanner.tsx` uses the native `BarcodeDetector` and lazy-loads
  `@zxing/browser` only where there isn't one (iPhone Safari); it needs https
  or localhost.

### MCP server + OAuth (`/api/mcp`)

- Hand-rolled JSON-RPC tools server. Two Bearer credentials: the `htm_`
  personal API key (Shortcuts / manual MCP config) and `hto_` OAuth access
  tokens (claude.ai / ChatGPT / Copilot connectors). Both resolve to the same
  caller; every tool re-checks the user's live page permission.
- OAuth 2.1 authorization server is in-app, no library: pure logic in
  `src/lib/oauth-core.ts` (import-free, unit-tested), HTTP glue in
  `src/lib/oauth-http.ts`, models `OAuthClient` / `OAuthCode` / `OAuthGrant`.
  Discovery under `src/app/.well-known/`, consent at `/oauth/authorize`,
  endpoints under `/api/oauth/{register,token,revoke}`.
- Issuer = request origin, so prod/previews/localhost each advertise their
  own. Don't hardcode `https://www.hatom.im` in metadata — ChatGPT rejects an
  issuer that differs from the URL it fetched.
- One `oauthGrants` doc per (user, client) = one "connected app"; revoking
  deletes it. Tokens/codes/secrets are stored only as SHA-256 hashes. Refresh
  tokens rotate strictly (atomic `findOneAndUpdate`).
- `/oauth/authorize` never auto-redirects to a redirect_uri except on
  Allow/Deny; protocol errors render a click-through link instead (open
  redirect via dynamic registration otherwise — RFC 9700 §4.11.2). The user
  must also be signed in before any of that renders.
  It's served with `X-Frame-Options: DENY` (`next.config.js`) because the site
  CSP has no `frame-ancestors`.

## Quick sanity checks before making changes

- `cat .vercel/project.json` — is this repo linked to the right Vercel project?
- `vercel env ls` — are the expected env vars present?
- `git status -s --untracked-files=all` — working tree clean?
- `git log --oneline origin/main..HEAD` — anything unpushed?
