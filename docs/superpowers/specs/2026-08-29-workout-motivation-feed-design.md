# Workout: Motivation Feed — Design

**Date:** 2026-08-29
**Status:** Approved

## Goal

A new **Feed** tab in the workout app where users share completed workouts
and get motivated by each other. A feed item reads like:

> **Tomer** · Push Day · Thu, Aug 6
> 16 sets · 6/6 exercises · 780 kg
> *"That's 3 vending machines 🥤 you gently launched into orbit…"*

Sharing happens from the completion summary (primary) or retroactively from
a workout in history. **The feed is ordered by when the workout happened,
not when it was shared** — a retro-shared workout from last week slots into
last week, it does not jump to the top.

## Approach

One new Mongo collection (`workoutFeedPosts`), one new API segment, one new
page + nav tab, two share entry points. A post is a **server-computed
snapshot** of the workout's stats at share time — feed reads never join the
workouts collection, and a post survives later edits/deletion of the
workout. The brag line is **not stored**: `getVolumeBrag(totalVolumeKg,
language, workoutId)` is pure and deterministic, so the feed recomputes it
client-side in the *viewer's* language — sharer and viewer see the same
joke, each in their own tongue. (Consequence, accepted: if brag copy ever
changes, old posts show the new copy.)

Identity follows the post-SSO model: **userId = session email**, derived
server-side via `requireSignedIn()`; any client-supplied userId is ignored
(same contract as `api/workout/workouts/route.ts`). Display names via
`getUserDisplayName()` from `src/types/workout.ts`.

## Data model — `src/models/WorkoutFeedPost.ts` (new)

Typed-functions pattern (one file per collection, `get*`/`create*`/`delete*`
helpers, no ODM wrapper — see `src/models/CoffeeReview.ts`).

```ts
export interface WorkoutFeedPost {
  id: string;
  userId: string;              // session email of the sharer == workout owner
  workoutId: string;           // unique — one post per workout
  workoutName: string;         // canonical (English) name; localized at render
  workoutDate: string;         // Workout.date (YYYY-MM-DD) — primary sort key
  workoutStartedAt: string;    // Workout.createdAt (full ISO) — tiebreaker
  stats: {
    setsLogged: number;
    exercisesDone: number;
    exercisesTotal: number;
    totalVolumeKg: number;     // seed for the brag + volume display
  };
  sharedAt: string;            // ISO, audit only — never used for ordering
}
```

Indexes: unique on `workoutId`; compound `{ workoutDate: -1, workoutStartedAt: -1 }`
for the feed query.

**Extract the stats computation.** The sets/exercises/volume reduction
currently lives inline in `CompletionSummary`
(`src/app/workout/page.tsx` ~854–873). Move it to a shared
`computeWorkoutStats(workout)` in a new `src/lib/workout-stats.ts`, used by
both the modal and the share endpoint — the snapshot must be computed
server-side from the loaded workout, never trusted from the client.

## API — `src/app/api/workout/feed/`

- **`GET /api/workout/feed?limit=N&skip=M`** — all users' posts, sorted
  `(workoutDate desc, workoutStartedAt desc)`. Pagination mirrors the
  history pattern in `api/workout/workouts/route.ts` (clamped limit,
  back-compat no-limit). Response items include `displayName` resolved
  server-side.
- **`POST /api/workout/feed` `{ workoutId }`** — loads the workout; 404 if
  missing, 403 if `workout.userId !== session email`, 400 if not
  `isCompleted`, **409 if already shared**. Computes the snapshot
  server-side, inserts, returns the post.
- **`DELETE /api/workout/feed/[workoutId]`** — unshare; own posts only
  (403 otherwise). Re-sharing after unshare is allowed and refreshes the
  snapshot (that's the stale-snapshot escape hatch — no edit endpoint).

All three behind `requireSignedIn()`.

## UI

- **Nav**: add `{ href: '/workout/feed', labelKey: 'nav.feed', icon: '🔥' }`
  to `src/components/workout/BottomNav.tsx`.
- **Feed page** (`src/app/workout/feed/page.tsx`): scrollable list, newest
  workout first, incremental load (same limit/skip mechanism as History).
  Item layout: header row (display name, localized workout name via
  `getLocalizedTemplateName`, date via the existing `formatDate`), stat row
  (sets · done/total exercises · volume in the **viewer's** kg/lb unit,
  converted from `totalVolumeKg` like the summary modal does), then the brag
  card reusing `.workout-summary-brag` styling. Posts by the viewer get an
  unshare affordance (small ✕ / long-press menu — implementer's choice).
  Empty state: friendly i18n'd prompt to complete + share a workout.
- **Share from completion** (`CompletionSummary` in
  `src/app/workout/page.tsx`): a secondary button under the CTA —
  "Share to feed 📣". On success it flips to a disabled "Shared ✓";
  409 also renders as "Shared ✓". Errors keep the modal usable (silent
  console + toast-less inline text; no blocking).
- **Share from history** (`src/app/workout/history/[id]/page.tsx`): same
  button for completed workouts; same shared-state handling. The page
  should know the shared/not-shared state on load (either a
  `GET /api/workout/feed?workoutId=` lookup or an exists-check param —
  implementer's choice, keep it one round trip).

## i18n (`src/lib/workout-i18n.ts`)

New keys, EN + HE. Hebrew uses passive/neutral phrasing to avoid gendering
the sharer ("אימון הושלם" rather than "השלים/ה"):

| key | en | he |
|---|---|---|
| `nav.feed` | Feed | פיד |
| `feed.title` | Motivation Feed | פיד מוטיבציה |
| `feed.completedWorkout` | completed a workout | השלמת אימון |
| `feed.share` | Share to feed 📣 | שיתוף בפיד 📣 |
| `feed.shared` | Shared ✓ | שותף ✓ |
| `feed.unshare` | Remove from feed | הסרה מהפיד |
| `feed.empty` | Complete a workout and be the first to flex here 💪 | סיימו אימון והיו הראשונים להשוויץ כאן 💪 |

(Exact copy is the implementer's to polish; neutrality constraint is not.)

## Ordering — the invariant that must not regress

Feed order is `(workoutDate desc, workoutStartedAt desc)`. `sharedAt` exists
for audit but **must never influence ordering**. Add this as an explicit
test/acceptance check: share workout A (dated Aug 20), then share the older
workout B (dated Aug 10) — B must appear *below* A.

## Work packages (each independently shippable, in order)

**WP1 — Model + API.** `WorkoutFeedPost.ts`, `computeWorkoutStats`
extraction, GET/POST/DELETE routes with the auth/validation matrix above.
*Accept:* tsc/lint/build green; POST is idempotent-guarded (409); DELETE
enforces ownership; GET returns snapshot-sorted pages; the CompletionSummary
modal still shows identical numbers after the stats extraction.

**WP2 — Feed page + nav.** Page, tab, item rendering with recomputed brag,
viewer-unit volume, RTL-correct layout, empty state, pagination.
*Accept:* the ordering invariant above holds in the UI; Hebrew mode renders
RTL with localized workout names; brag matches what the sharer saw (same
workoutId seed).

**WP3 — Share entry points.** Buttons in the completion modal and history
detail with shared-state handling.
*Accept:* fresh completion → share → post appears; retro-share from history
slots by workout date; re-tapping share is a no-op ("Shared ✓").

## Non-goals

- No reactions, comments, or push notifications (v2 candidates — ntfy/web
  push would ride on this later).
- No deep-link from a feed item into another user's workout detail (history
  stays private per-user).
- No editing of a post's snapshot (unshare + reshare refreshes it).
- No pagination cursors beyond the existing limit/skip pattern.
- No feed entries for anything but completed workouts ("skill unlocked"
  posts are a future synergy with the calisthenics-progressions spec).
