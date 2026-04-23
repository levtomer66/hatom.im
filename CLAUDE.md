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
- **Pre-commit hook** (Husky) runs `next build`. A failed build blocks the
  commit. If the Next cache seems stuck (e.g. `Cannot find module for page:
  /_document`), `rm -rf .next` and retry — this has happened twice.

## Running things

```bash
# dev server (picks next available port; usually :3000)
npm run dev

# verify before commit
npx tsc --noEmit --incremental false --pretty false
npm run lint
npm run build
```

## Shipping

The project-level slash command is the blessed path:

```
/ship                         # commit message auto-generated
/ship "scope: short subject"  # custom subject
```

`/ship` implements the full loop: git state probe → `/codex:review` (background
when diff > 2 files) → fix P0/P1 (judge P2/P3) → tsc + lint + build → commit →
push (fast-forward only; asks before force-pushing). Source:
`.claude/commands/ship.md`.

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
| `TRIP_ADMIN_TOKEN`      | `src/lib/tripAdmin.ts` — admin gate on `/api/trip/journey/*` writes. Client sends `X-Admin-Token`. |

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
- Users are three fixed IDs: `tom`, `tomer`, `amit` (see `src/types/workout.ts`
  — single `USER_IDS` array is the source of truth).
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
