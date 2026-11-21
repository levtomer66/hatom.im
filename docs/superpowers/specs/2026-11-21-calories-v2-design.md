# Calories v2: search bar, workouts, shared weight, recommended goal

Adds to `2026-11-21-calories-design.md` (which still holds everything not
changed here). Asked for by the owner after reviewing v1 on 2026-11-21.

## What the owner asked for

1. The "הוספה" button becomes a search bar with a barcode button, like
   /shopping's. Under it a **ארוחה** button: create home-made meals from your
   products and log them. Home-made meals leave ⚙.
2. Body weight is shared with the workout app both ways.
3. Finished workouts count as burned calories.
4. The meal card for the current hour is highlighted.
5. A goal (lose / keep / gain); calories and protein come from the app's
   recommendation.

Owner's answers: the burn is an estimate you can correct; the
recommendation asks a full profile (Mifflin-St Jeor); recommended numbers
are prefilled and editable; one shared weight plus a weigh-in log.

## Day screen

Order: head (‹ date › ⚙), ring, **search**, **ארוחה** button, meal cards,
workouts, weight card, week.

- **Search** (`sh-search-box`, like shopping): 🔍, input, spinner, then the
  barcode button, or ✕ once there's text. Results open under the box in the
  page (not a sheet): home-made meals, generic foods, products, as in v1's
  FoodPicker. Empty and focused: recent foods (one tap logs them to the
  current meal), My items, quick add. A click outside closes the results.
  A pick opens the amount sheet: meal chips (current meal picked) + v1's
  amount step (or the label form). Scan → that product's amount sheet.
- **ארוחה** opens the home-made meals sheet: each meal with "רישום" (opens
  the amount sheet for it) and edit; "ארוחה חדשה" opens v1's editor. ⚙ no
  longer links to meals.
- **Current meal**: on today only, the card for `defaultMeal(hour)` gets
  `is-now` (accent border) and a small "עכשיו". Re-checked with the
  midnight check (60 s / focus / visible).
- Each meal card keeps its ＋ (the add sheet with that meal, as in v1).

## Workouts (burned)

- The day reads the caller's completed workouts whose `date` (first 10
  chars) is the day, from the workout collection (read only; `userId` =
  session email). Known gap: the workout app writes `date` in UTC, so a
  workout started 00:00–03:00 Israel time lands on the day before.
- Estimate (`workoutBurn`, pure): a set counts when it has reps > 0 or
  seconds > 0; minutes = sets × 3; kcal = 5 (MET) × kg × minutes / 60,
  rounded to 5. kg = the shared body weight, else 70 with "לפי 70 ק״ג".
- A correction is stored on the day doc: `burned: { [workoutId]: kcal }`
  (0–3000, integer). The workout itself is never written.
- Ring: **left = goal − eaten + burned**; under it "N נאכלו · M באימון"
  when M > 0. Week bars stay "eaten" (unchanged).
- Shown as a "אימונים" card with a row per workout ("🏋️ name · kcal",
  "משוער" when not corrected); tap → a small sheet with a number field,
  "שמירה" and "לחזור להערכה" (removes the correction).
- Another session is adding phone step counts; `burned` is per workout id
  so other sources can sit beside it later. Not designed here.

## Weight

- **One current weight**: `workoutUserSettings.bodyweightKg` (model
  `WorkoutUserSettings`, `getUserSettings` / `setBodyweight`). Calories
  reads and writes that field; nothing is copied, so a change in either
  app is the change.
- **Weigh-ins** on `caloriesUsers.weighIns: {d: 'YYYY-MM-DD', kg}[]`, one
  per day (a later one that day replaces it), newest last, max 400.
  Saving weight in calories = `setBodyweight` + a weigh-in for the client's
  today. On `GET day` for today, when the shared weight differs from the
  last weigh-in, a weigh-in is added for today (so changes made in the
  workout app reach the log).
- **Weight card**: current kg, change since 30 days ago (from the log),
  a tiny line of the last 30 days' weigh-ins, "עדכון" → number field.
  0 weigh-ins → just the field.
- Bounds: 25–400 kg, 0.1 steps.

## Goal and recommendation (⚙)

`Settings` grows (all optional, old docs still parse):

```
profile?: { sex: 'm'|'f'; birthYear: number; heightCm: number;
            activity: 1.2|1.375|1.55|1.725 }
aim?: 'lose'|'keep'|'gain'
followRec?: boolean   // the goals track the recommendation
```

`recommend(profile, aim, kg, year)` (pure):
- BMR = 10·kg + 6.25·cm − 5·age + (m: 5, f: −161); age = year − birthYear.
- kcal = BMR × activity + (lose −500, keep 0, gain +300), at least
  1500 (m) / 1200 (f), rounded to 50.
- protein = kg × (lose 2.0, keep 1.6, gain 1.8), rounded to 5.
- Activity = daily life **without** workouts (they're added back as
  burned): יושבני 1.2, קל 1.375, פעיל 1.55, פעיל מאוד 1.725.
- Null without a profile or a weight.

⚙ sheet: aim chips, profile fields, weight, then calories + protein
prefilled from the recommendation with "לפי ההמלצה: N". Editing a number
sets `followRec: false`; "לפי ההמלצה" sets it back. While `followRec`, the
server recomputes goal/protein on read (`GET day`) from the current weight,
so a weigh-in moves them. First visit: the welcome card becomes this form.

## API changes

- `GET day` → adds `burned: {id, name, kcal, est, sets}[]`, `weight: {kg,
  log: {d,kg}[] (last 60 days)} `, and `rec` (the recommendation or null).
- `PUT settings` accepts the new fields (validated: birthYear 1920–year−13,
  height 120–230, activity one of four, sex, aim).
- `PUT weight {date, kg}` → setBodyweight + weigh-in.
- `PUT burned {date, workoutId, kcal|null}`.

## Testing

Pure, `node --test`: `recommend` (both sexes, floors, rounding, null),
`workoutBurn` (counted sets, no weight → 70, rounding), `pushWeighIn`
(same day replaces, cap 400), `parseSettings` with a profile, `leftToday`
(goal − eaten + burned). Browser at 375 px: search + scan path, ארוחה,
highlight, workout row + correction, weight both ways (change it on
/workout, see it on /calories), ⚙ recommendation and override.

## Out of scope

Steps (another session), a weight chart beyond 30 days, macros other than
protein as goals, fixing the workout app's UTC date.
