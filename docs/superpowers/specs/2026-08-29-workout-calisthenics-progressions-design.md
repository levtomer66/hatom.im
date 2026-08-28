# Workout: Calisthenics Progressions — Design

**Date:** 2026-08-29
**Status:** Approved

## Goal

Make calisthenics a first-class citizen of the workout app. The core gap:
progression ladders (tuck → advanced tuck → straddle → full planche) are
prose inside exercise descriptions today, so a logged "Planche Progression,
20s" can't tell a tuck from a full planche — the most important datum in
calisthenics isn't captured. Secondary gap: bodyweight rep sets (`kg: null`)
produce **no PB at all** because `epleyE1rm` returns 0 without a weight.

## Design thesis

**Calisthenics is not a new app mode — it's a richer exercise type.** The
user's own split is hybrid (weighted dips + planche work in one session), so
the "mode" lives at the exercise level: an exercise that carries a
`progression` ladder gets the skill UI; barbell exercises are untouched.
Same templates, same workout flow, no data migration (all new fields
nullable/optional, same retrofit trick as `WorkoutSet.seconds`).

## Data model changes (`src/types/workout.ts`)

```ts
// New — ordered ladder on an exercise definition
export interface ProgressionStep {
  id: string;                    // 'tuck' | 'adv-tuck' | 'straddle' | 'full'…
  name: string;                  // canonical English; Hebrew via exercise-translations
  measure: 'seconds' | 'reps';   // drives the set row's default mode
  cue?: string;                  // short form cue, English canonical
  advanceAt?: { value: number; sets: number }; // e.g. {15, 3} = 15s × 3 sets → suggest next step
}

// ExerciseDefinition gains:
progression?: ProgressionStep[];   // ordered easiest → hardest

// WorkoutSet gains (nullable — legacy sets arrive without it, like `seconds`):
stepId?: string | null;
```

`PersonalBest` gains (all optional; computed in the `PersonalBestStore`
scan that already runs on workout complete/delete — see commit `1227bd1`):

```ts
stepBests?: Record<string, { best: number; date: string; workoutId: string }>;
                    // per stepId; unit = the step's measure
frontierStepId?: string | null;   // highest-indexed step ever logged
// The missing bodyweight lane — rep-mode sets with kg == null:
bestBodyweightReps?: number | null;
bestBodyweightRepsDate?: string | null;
bestBodyweightRepsWorkoutId?: string | null;
```

Rules:
- A set's `stepId` must belong to the exercise's ladder; the save path
  strips unknown ids to `null` (permissive, same spirit as
  `resolveExerciseId`). Never 400 on a stale step id.
- Legacy sets (no `stepId`) keep counting toward the exercise-level
  time/rep PBs exactly as today; they simply don't join a ladder.
- `kg` on a laddered set = **added** weight (e.g. weighted straddle
  planche); stays allowed, label the input "+kg" on laddered exercises.

## Ladder content (`src/data/exercise-library.ts`)

Eight existing entries gain ladders. `handstand-progression` is the
**balance** ladder (seconds) and `handstand-hspu-progression` is repurposed
as the **pressing** ladder (reps) — the two entries already exist, so the
prose-conflated skill splits with no new ids. Hebrew step names ship in
`src/lib/exercise-translations/he.ts` — extend the per-exercise entry with
optional `steps: Record<stepId, string>` (adapt to the file's actual entry
shape; fall back to English name when a step translation is missing, same
fallback contract as names/descriptions).

| Exercise | Steps (id — EN — HE — advanceAt) |
|---|---|
| `planche-progression` (seconds) | `tuck` — Tuck Planche — טאק פלאנץ' — 20s×3 · `adv-tuck` — Advanced Tuck — טאק מתקדם — 15s×3 · `straddle` — Straddle Planche — פלאנץ' פישוק — 10s×3 · `full` — Full Planche — פלאנץ' מלא |
| `front-lever-progression` (seconds) | `tuck` — Tuck Front Lever — פרונט ליבר טאק — 20s×3 · `adv-tuck` — Advanced Tuck — טאק מתקדם — 15s×3 · `straddle` — Straddle Front Lever — פרונט ליבר פישוק — 10s×3 · `full` — Full Front Lever — פרונט ליבר מלא |
| `handstand-progression` (seconds) | `wall-back` — Back-to-Wall Handstand — עמידת ידיים גב לקיר — 45s×3 · `wall-chest` — Chest-to-Wall Handstand — עמידת ידיים חזה לקיר — 45s×3 · `freestanding` — Freestanding Handstand — עמידת ידיים חופשית |
| `handstand-hspu-progression` (reps) | `pike` — Pike Push-Up — שכיבת סמיכה פייק — 10×3 · `elevated-pike` — Elevated Pike Push-Up — פייק מוגבה — 8×3 · `wall-hspu` — Wall HSPU — HSPU על קיר — 5×3 · `freestanding-hspu` — Freestanding HSPU — HSPU חופשי |
| `muscle-up-progression` (reps) | `chest-to-bar` — Chest-to-Bar Pull-Up — מתח חזה למוט — 5×3 · `high-pullup` — High Pull-Up — מתח גבוה — 3×3 · `band-mu` — Banded Muscle-Up — מאסל-אפ עם גומייה — 3×3 · `muscle-up` — Muscle-Up — מאסל-אפ |
| `l-sit` (seconds) | `tuck-sit` — Tuck Sit — ישיבת טאק — 20s×3 · `one-leg` — One-Leg L-Sit — אל-סיט רגל אחת — 15s×3 · `l-sit` — L-Sit — אל-סיט — 10s×3 · `v-sit` — V-Sit — וי-סיט |
| `pistol-squat` (reps, per-leg cue) | `assisted` — Assisted Pistol — פיסטול נתמך — 8×3 · `box` — Box Pistol — פיסטול לקופסה — 6×3 · `full` — Full Pistol Squat — פיסטול מלא |
| `front-lever-row` (reps) | `tuck-row` — Tuck FL Row — חתירת ליבר טאק — 8×3 · `straddle-row` — Straddle FL Row — חתירת פישוק — 6×3 · `full-row` — Full FL Row — חתירה בליבר מלא |

Weights of `advanceAt` values are training conventions, not sacred — keep
them data, not code.

## UI

- **Set row** (`src/app/workout/page.tsx`, active-workout view): on laddered
  exercises each set row gets a **step chip** before the inputs. Tapping
  opens a step picker (ladder order, current frontier highlighted, cue shown).
  Default step = the set's prefilled `stepId` (from `lastSets`), else the
  user's `frontierStepId`, else step 0. The chosen step's `measure` sets the
  row's default mode (seconds vs reps); manual override stays possible.
- **Prefill & nudge**: prefill copies `stepId` per set from `lastSets` (the
  existing kg/reps prefill mechanism). If the frontier step's `stepBests`
  meets its `advanceAt`, highlight the *next* step in the picker with a
  "Ready to try ✨" tag. Nudge is a suggestion only — never auto-advance.
- **Exercise detail page** (`src/app/workout/exercises/[id]/page.tsx`): for
  laddered exercises replace the e1RM chart with a **ladder view** — steps as
  rungs, per-rung best (+date), frontier highlighted; history list entries
  show their step name. Non-laddered exercises unchanged.
- **Skills overview**: a section (top of `/workout/exercises` filtered view
  or its own `/workout/skills` route — implementer's choice, keep it one
  screen) listing every laddered exercise with the user's frontier badge and
  progress toward `advanceAt`. This screen is the "calisthenics mode" as a
  place.
- **Unlock celebration**: on workout complete, if any set's `stepId` is
  beyond the pre-workout frontier, the completion summary shows a
  "🔓 {step name} unlocked!" line above the volume brag (both can show).
  Reuse `.workout-summary-brag` styling with a distinct border color.
- **History** (`/workout/history/[id]`): sets display their step name next
  to the value ("Straddle · 12s").

## i18n

New keys in `src/lib/workout-i18n.ts` (flat dictionary, EN + HE): step
picker title, "Ready to try", "unlocked!", skills-screen title, "+kg" label.
Step *names* go through exercise-translations (above), not workout-i18n.
Full RTL flip applies; the ladder view must mirror in Hebrew.

## Work packages (each independently shippable, in order)

**WP1 — Types + data + translations.** `ProgressionStep`,
`ExerciseDefinition.progression`, `WorkoutSet.stepId`, the 8 ladders,
Hebrew step names, save-path stepId sanitization.
*Accept:* tsc/lint/build green; a workout saved with a valid `stepId`
round-trips; an unknown `stepId` is stripped to null; legacy workouts load
unchanged.

**WP2 — Logging UI.** Step chip + picker in the set row, measure-driven
mode default, "+kg" label, step names in history views.
*Accept:* on a laddered exercise every set can carry a different step;
non-laddered exercises render exactly as before; RTL correct.

**WP3 — PB store.** `stepBests`, `frontierStepId`, bodyweight-reps lane in
`src/models/PersonalBestStore.ts` (inside the existing complete/delete
scan), step prefill from `lastSets`, advance nudge in the picker.
*Accept:* completing a workout updates step bests + frontier; a bodyweight
pull-up set finally produces a PB; nudge appears only when `advanceAt` is
met at the frontier step.

**WP4 — Ladder view + skills screen + unlock celebration.**
*Accept:* laddered exercise page shows rungs w/ bests instead of e1RM chart;
skills screen lists frontiers; completing a first-ever straddle set fires
the unlock line in the summary.

## Non-goals

- No EMOM/density protocols, no attempt-count tracking (notes cover it).
- No user-editable ladders (`CustomExercise` stays ladder-less; revisit later).
- No Mongo migration; no changes to non-laddered exercises' UI or PB math.
- No auto-advance — the user always picks the step.
- Feed integration ("skill unlocked" posts) is a future synergy with the
  motivation-feed spec, out of scope here.
