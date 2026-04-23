# hatom.im

Personal family site for Tomer Lev — one Next.js app that hosts several
independent features under separate routes:

- **`/workout`** — workout tracker with templates, history, Hebrew/English toggle,
  drag-and-drop exercise reordering, YouTube/Instagram exercise links, and a
  help FAB that posts feedback to ntfy.sh.
- **`/trip.html`** — static trip page for USA + Mexico 2026 with progress bar,
  calendar, map, and a **digital journey** (bulk photo upload with EXIF-driven
  auto-routing to the correct day, photos stored on Vercel Blob).
- **`/mekafkefim`** — coffee reviews with per-reviewer ratings and photo uploads.
- **`/instomit`**, **`/greeting`**, **`/family-tree`** — smaller pages (videos, a
  greeting page, a family tree visualisation).

Production: <https://www.hatom.im>

## Stack

- **Next.js 15** (App Router) — React 19, TypeScript, no `src/pages/`.
- **MongoDB** (Mongoose) for most feature data.
- **Vercel Blob** for binary uploads (trip photos).
- **Tailwind CSS** + per-section scoped CSS files (e.g. `workout.css`).
- **@dnd-kit** for drag-and-drop in the workout section.
- **Leaflet** for maps on `/trip.html`.
- **react-icons**, **uuid**, **framer-motion** as utilities.

## Local setup

```bash
# 1. Install
npm install

# 2. Pull secrets from Vercel (requires `vercel login` + repo linked to the
#    `hatom-im` project). See docs/vercel.md equivalent section below.
vercel env pull .env.local

# 3. Dev server on :3000
npm run dev

# 4. Lint / typecheck / production build
npm run lint
npx tsc --noEmit
npm run build
```

`.env.local` is gitignored. After `vercel env pull` it should contain at least:

| Var                     | Purpose                                                                 |
|-------------------------|-------------------------------------------------------------------------|
| `MONGODB_URI`           | Mongo connection string used by every API route.                        |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for the `hatomim-trip-photos` store. Auto-provisioned when the Blob store is linked to the project. |
| `TRIP_ADMIN_TOKEN`      | Shared-secret gate for write endpoints under `/api/trip/journey/*`. Compared in constant time against the `X-Admin-Token` header. |
| `VERCEL_OIDC_TOKEN`     | Added by the Vercel CLI for local OIDC — not used by app code.          |

## Vercel setup (one-time)

This repo lives on Vercel project **`hatom-im`** under the
`levtomer66s-projects` scope, deployed automatically on every push to `main`.

```bash
# one-time per workstation
npm install -g vercel
vercel login
vercel link --yes --project hatom-im

# sync env into .env.local
vercel env pull .env.local

# manual prod deploy (if you can't push)
vercel --prod
```

### Blob store

One public store, `hatomim-trip-photos`, created with:

```bash
vercel blob create-store hatomim-trip-photos --access public --yes
```

The `--yes` flag links it to all three environments (Production, Preview,
Development) and auto-creates the `BLOB_READ_WRITE_TOKEN` env var.

### Adding an env var from the CLI

Non-interactive syntax (the interactive prompts hang when called from agents):

```bash
# Production / Development: straightforward
echo "$VALUE" | vercel env add VAR_NAME production
echo "$VALUE" | vercel env add VAR_NAME development

# Preview: must pass --value + --yes + --force, and "" as the branch arg to
# mean "all preview branches".
vercel env add VAR_NAME preview "" --value "$VALUE" --yes --force
```

## Repository map

```
.claude/commands/ship.md     Project-level slash command: review + lint + build + commit + push
public/trip.html             Static trip page (standalone — no Next route)
src/app/<route>/page.tsx     App-router pages
src/app/api/<route>/route.ts Route handlers (GET/POST/…)
src/components/              React components grouped by feature
src/context/                 React context providers (WorkoutUser, WorkoutLanguage)
src/data/exercise-library.ts ~140 canonical exercise definitions (English)
src/lib/exercise-translations/ Per-language translation files (he.ts, + registry)
src/lib/workout-i18n.ts      Flat UI dictionary + useT() hook for /workout
src/lib/mongodb.ts           Mongo client singleton
src/lib/tripAdmin.ts         Constant-time admin-token check for /api/trip/journey writes
src/models/                  Mongo model helpers (typed functions, not classes)
src/types/                   Shared TypeScript types
next.config.js               CSP headers and image config
```

## Shipping changes

The project-level slash command `/ship` orchestrates the full pipeline:

1. `git status` to detect uncommitted / committed-but-unpushed work.
2. Run `/codex:review` (background for non-trivial diffs).
3. Apply findings (P0/P1 required; P2/P3 judged).
4. `tsc --noEmit` → `next lint` → `next build`.
5. Commit with a descriptive subject + the standard co-author trailer.
6. Push — fast-forward only, never force-pushes without asking.

See `.claude/commands/ship.md` for the exact prompt; invoke with `/ship` inside
Claude Code.

## Non-automated things

- **Vercel login** (`vercel login`) and **linking** (`vercel link`) are
  interactive one-time steps per workstation.
- Creating the Blob store is automated; rotating the admin token or MongoDB
  credentials is manual.
