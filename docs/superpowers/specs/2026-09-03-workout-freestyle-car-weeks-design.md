# Workout: Freestyle Workouts · The Moving Car · Weekly History — Design & Decisions

**Date:** 2026-09-03
**Status:** Implemented (autonomous pass — decisions below are open for review)

Three independent features requested together. Each section lists the
decision taken, the alternatives considered, and why. Anything marked
**⚖️ Review** is a judgement call the requester may want to flip.

---

## 1. "Start new workout" — freestyle workouts (no template)

### What ships

- In the start-workout selector (**My Workouts** tab), a **▶ Start Empty
  Workout** button sits beside **+ Create New Workout** — both in the list
  footer and in the first-run empty state.
- Tapping it creates a workout named **Freestyle Workout** (canonical
  English; Hebrew "אימון חופשי" via `TEMPLATE_NAME_TRANSLATIONS`) with no
  template and no exercises, opens the active-workout view, and immediately
  opens the exercise picker so the first exercise is one tap away.
- Everything else in the active view is unchanged: add / replace / remove /
  reorder exercises, autosave, rest timer, PB hints.
- On **Complete**, if the workout has no template and at least one exercise,
  the completion summary shows a **"Save this workout for next time?"** card:
  a name field + **Save workout**. Saving creates a template whose entries are
  derived from what was actually done (exercise order, `numSets` = sets
  logged clamped to 1–5, notes, superset groups), then renames the workout
  and links it to the new template (`templateId`) so history / feed show the
  chosen name and template usage counts stay honest. The card flips to
  "Saved to My Workouts ✓".

### Decisions & alternatives

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1.1 | Freestyle = `templateId == null`; no new boolean on `Workout`. | Add `isFreestyle: true` to the schema. | Template-started workouts always carry a `templateId`, so null is already unambiguous; avoids a migration and a second source of truth. |
| 1.2 | Default name "Freestyle Workout", translated like other well-known names. | Ask for a name up-front; use the date as the name. | Zero friction at start (the user wants to lift, not type); the name is asked for at the end when they know what the session became. |
| 1.3 | Auto-open the exercise picker right after creation. **⚖️ Review** | Land on the empty active view and let the user tap "+ Add Exercise". | Saves a tap on every freestyle start; the picker can be dismissed. |
| 1.4 | Save-as-template lives inside the completion summary (same modal). | A separate "name & save" modal before the summary; a prompt() dialog. | One modal, no extra step; the user still gets the stats + confetti first. Skipping is simply closing the modal. |
| 1.5 | Saving also renames the workout and sets `templateId`. | Leave the workout named "Freestyle Workout". | History and the feed should show the name the user chose; linking makes the template's usage count include the session that created it. |
| 1.6 | Template `numSets` = number of sets logged (clamped 1–5). | Always 3; count only sets with data. | Mirrors what was actually done; the clamp respects `MIN_SETS`/`MAX_SETS`. |
| 1.7 | Freestyle workouts with zero exercises can still be completed (existing behaviour); the save card is hidden in that case. | Block completion of an empty workout. | No new rules; an empty template is useless anyway. |
| 1.8 | Renaming mid-workout is **not** offered. **⚖️ Review** | Editable title in the header for freestyle workouts. | Kept the scope tight; the end-of-workout name covers the stated need. |

---

## 2. The Moving Car (motivation feed)

### What ships

- A **pinned strip** at the top of the Feed page (sticky under the header,
  above all posts): a 1-ton car 🚗 on a track, driving from the start to a
  🏁 finish flag. Every shared workout's total volume pushes it forward.
- **Conversion:** the car weighs 1 000 kg, so **every 1 000 kg lifted moves
  it 1 m**. The strip shows `Level N · <travelled> / <target> m`, a
  remaining-distance hint, and who's pushing (per-user tonnage).
- **Levels:** Level 1 finishes at 50 000 kg (50 m). Each next level's
  distance is ×1.25 the previous (rounded to whole metres), so the
  destination keeps getting further: 50 → 63 → 78 → 98 → 122 → 153 m …
- **Level-up celebration:** when the strip loads at a higher level than the
  viewer last saw (stored per device in `localStorage`), a short
  "Level up! 🎉" flash plays on the strip.
- **After sharing** from the completion summary, the button flips to
  "Shared ✓" and a line appears: "You pushed the car +2.3 m 🚗".
- New endpoint `GET /api/workout/feed/car` → `{ totalKg, postCount,
  byUser: [{ userId, displayName, kg, posts }] }` (one `$group`
  aggregation over `workoutFeedPosts`). All level maths is a pure function
  in `src/lib/workout-car.ts`, shared by client and any future server use.

### Decisions & alternatives

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 2.1 | Car state is **derived purely from the running total** of all posts (`computeCarState(totalKg)`); nothing is stored. | Store `level`/`progress` documents and mutate on share; store a high-water mark. | No new collection, no write races, no drift between posts and the car. Trade-off: unsharing a post rolls the car back (even a level) — honest and rare. |
| 2.2 | Total = sum of `stats.totalVolumeKg` across **all** feed posts ever, all users. | Only posts since launch of the car; per-user cars; weekly reset. | "Accumulating feeds total KGs" — a shared group goal is the motivational point. Existing posts give the car a head start on day one. |
| 2.3 | 1 000 kg → 1 m, Level 1 = 50 m, growth ×1.25. **⚖️ Review** | Linear growth (+25 m/level); ×1.5; ×2. | Three friends at ~3–5 workouts/week ≈ 30–50 t/week → a level every 1–3 weeks early on, slowing gently. Constants live in one place (`workout-car.ts`). |
| 2.4 | Sticky strip under the header on the Feed page ("always on top"). | Static first item; a floating pill; on every workout page. | Stays visible while scrolling posts, which is where the shares it celebrates live. Not shown on other tabs to keep them uncluttered. |
| 2.5 | Direction follows the UI direction: LTR drives left→right, RTL (Hebrew) drives right→left; the emoji is mirrored with `scaleX(-1)` where needed so it faces the way it travels. **⚖️ Review** | Always left→right regardless of language. | The workout app does a full RTL flip; a left→right bar in a RTL page would read as "going backwards". Vehicle emojis face left on all major platforms, hence the flip in LTR. |
| 2.6 | Per-user tonnage line under the track (e.g. "Tom 12.3 t · Tomer 9.8 t"). | Total only. | One extra `$group` field; friendly competition with zero extra requests. |
| 2.7 | Level-up flash keyed on `localStorage` per device. | Server-side "seen level" per user; push notification. | Cheap, no schema; a level-up is noticed the next time each person opens the feed. |
| 2.8 | The "+X m" delta after sharing is computed client-side from the workout's own stats. | Return before/after car state from `POST /feed`. | Pure conversion, no API change; the feed strip is the source of truth for the aggregate. |
| 2.9 | Emoji: 🚗 (car) with 🏁 finish. **⚖️ Review** | 🛻 pickup ("1-ton truck"); 🚚. | Best cross-platform rendering and readable at 22 px. Trivial to swap (one constant). |

---

## 3. History — weeks inside months (weeks start Sunday)

### What ships

- Completed workouts are grouped **Month → Week → workouts**. Each month
  header shows its total (e.g. "12 workouts"); each week header shows the
  Sunday–Saturday range and its own count (e.g. "Aug 30 – Sep 5 · 4
  workouts"). The current week is labelled **This week**, the one before
  **Last week**.
- Weeks run **Sunday → Saturday**, computed in the device's local time from
  the workout's `YYYY-MM-DD` date.
- Pure grouping logic lives in `src/lib/workout-weeks.ts` with unit tests.

### Decisions & alternatives

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 3.1 | A week that straddles two months is **never split**: it belongs to the month that contains its **Wednesday** (the month holding ≥4 of its 7 days). **⚖️ Review** | Split the week at the month boundary (each month shows its partial week); assign by the week's Sunday; assign by its Saturday. | The stated goal is an accurate "how many workouts this week" count, which a split destroys. The Wednesday rule is the Sun–Sat analogue of ISO-8601's Thursday rule. Consequence: a workout on Sun Aug 30 shows under **September** (inside "Aug 30 – Sep 5"); the week label makes this self-explanatory. |
| 3.2 | Dates parsed as **local** calendar dates (`new Date(y, m-1, d)`), not `new Date('YYYY-MM-DD')` (which is UTC midnight). | Keep the existing `new Date(str)` parsing. | Avoids the off-by-one day in negative-UTC time zones (e.g. the 2026 US trip); the month grouping inherits the fix. |
| 3.3 | Week ranges use `Intl.DateTimeFormat.formatRange` ("Aug 3 – 9", "Aug 30 – Sep 5", Hebrew-aware) with a two-date fallback. | Hand-built strings. | Correct locale punctuation and RTL ordering for free. |
| 3.4 | Counts reflect **loaded** workouts; with "Load more" pagination the oldest visible week may be partial until the next page loads. | Fetch whole weeks server-side; change the API to page by week. | Keeps the API untouched; only the last group at the page boundary can be affected, and only until "Load more". |
| 3.5 | Month header keeps the existing "September 2026" style, now with a count; week headers are one step smaller with a count pill. | Collapsible weeks; a calendar heat-map. | Minimal visual change; collapsing would hide the workouts the user came to see. |

---

## Cross-cutting

| # | Decision | Alternatives | Why |
|---|---|---|---|
| X.1 | Added a minimal `npm test` (Node's built-in `node:test`, no new dependency) for the two pure modules (`workout-weeks`, `workout-car`). `tsconfig` gains `allowImportingTsExtensions` so the tests can import `.ts` files the way Node's type-stripping needs. | No tests (repo had none); add vitest/jest. | Week-boundary and level maths are exactly the kind of logic that silently goes wrong; zero-dependency tests keep the repo's footprint unchanged. |
| X.2 | One commit per feature, then `/ship` (verify → review → push). | One big commit. | Matches the repo's WP-style history and keeps each feature revertable. |
| X.3 | All new copy is EN + HE, gender-neutral in Hebrew where a subject is implied. | EN only. | Repo convention (`workout-i18n.ts` is the single dictionary). |
