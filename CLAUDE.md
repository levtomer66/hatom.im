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
| `/mekafkefim`      | Coffee reviews with two reviewers (Tom, Tomer) and base64 photos in Mongo. |
| `/instomit`        | Video wall with comments + likes.              |
| `/family-tree`     | Tree visualisation (react-d3-tree).            |
| `/greeting`        | Small greeting page.                           |

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

- Photos stored base64 inside the Mongo document (`src/models/CoffeeReview.ts`);
  served via `/api/coffee-reviews/[id]/image`. This pattern pre-dates the
  Blob setup and is fine to leave alone.

## Quick sanity checks before making changes

- `cat .vercel/project.json` — is this repo linked to the right Vercel project?
- `vercel env ls` — are the expected env vars present?
- `git status -s --untracked-files=all` — working tree clean?
- `git log --oneline origin/main..HEAD` — anything unpushed?
