# Workout exercise library review

2026-11-19 · input for the machine-grid picker spec. The library has **180 exercises**
(`src/data/exercise-library.ts`, Hebrew in `src/lib/exercise-translations/he.ts`).

## What a rename costs

- **A display-name change costs nothing for history.** Workouts, templates, PRs and
  feed posts store only the exercise **id**; the name is looked up from the library
  (and `he.ts`) every time it's shown. Change the `name` and every past workout shows
  the new name. Ids stay as they are.
- **A merge** (two entries that are the same exercise) is one line in
  `EXERCISE_ID_ALIASES` (old id → kept id). History, PRs and progressions already go
  through `resolveExerciseId()`. This is how `lat-pulldown` and `hip-flexors` were
  folded before.
- **Custom exercises** are untouched; only the built-in library changes.

## Naming rule (proposed)

The machine grid now tells you *where* an exercise is done, so the name only needs
to say *what* it is.

1. **Selectorized / plate-loaded machine → bare movement name, no "Machine".**
   "Chest Press", "Leg Extension", "Seated Leg Curl". The machine tile is the context.
2. **Free weight or cable → the implement goes first**, only when the same movement
   exists with another implement: "Dumbbell Shoulder Press", "Cable Crunch",
   "Smith Squat".
3. **Classic barbell lifts keep their classic names**: Squat, Bench Press, Deadlift,
   Military Press, Romanian Deadlift.
4. **Both arms/legs is the default.** Mark only the one-sided version, always as
   **Single-Arm** / **Single-Leg** (not "One Hand", "SL", "Double-Arm").
5. **Grip before the movement**, hyphenated: "Wide-Grip Lat Pulldown",
   "Close-Grip …" (not "Pull Down", not "Narrow").
6. **Hebrew follows the same rule**: no "מכונת…" prefix; one verb per movement
   family (כפיפת / פשיטת / לחיצת / חתירת / הרחקת).

## 1. Drop "Machine" (rule 1)

| id | Now | New name | Now (he) | New name (he) |
|---|---|---|---|---|
| `chest-press-machine` | Chest Press Machine | **Chest Press** | מכונת לחיצת חזה | **לחיצת חזה** |
| `incline-chest-machine` | Incline Chest Press Machine | **Incline Chest Press** | מכונת לחיצת חזה עליון | **לחיצת חזה עליון** |
| `machine-shoulder-press` | Shoulder Press Machine | **Shoulder Press** | מכונת כתפיים | **לחיצת כתפיים** |
| `leg-press` | Leg Press Machine | **Leg Press** | מכבש רגליים | מכבש רגליים |
| `leg-extension` | Leg Extension Machine | **Leg Extension** | מכונת יישור רגליים | **פשיטת ברכיים** |
| `leg-curl` | Leg Curl Machine | **Seated Leg Curl** | מכונת כיפוף רגליים | **כפיפת ברכיים בישיבה** |
| `prone-leg-curl` | Prone Leg Curl Machine | **Lying Leg Curl** | כיפוף רגליים שכיבה | **כפיפת ברכיים בשכיבה** |
| `hip-abductors` | Hip Abductors Machine | **Hip Abduction** | פתיחת ירכיים | **הרחקת ירכיים** |
| `adductors` | Adductors Machine | **Hip Adduction** | סגירת ירכיים | **קירוב ירכיים** |
| `hip-thrust` | Hip Thrust Machine | **Hip Thrust** | היפ ת׳ראסט | היפ ת׳ראסט |
| `abs-machine` | Abs Machine | **Ab Crunch** | מכונת בטן | **כפיפות בטן בישיבה** |
| `trap-row-machine` | Trap Row Machine | **Chest-Supported Row** | חתירה לטרפזים במכונה | **חתירה בתמיכת חזה** |
| `pull-up-machine` | Pull-Up Machine | **Assisted Pull-Up** | מכונת מתח | **מתח בעזרה** |
| `calfs-leg-press` | Calf Press on Leg Press | **Leg Press Calf Raise** | שוקיים על מכבש רגליים | **הרמת עקבים במכבש** |
| `calf-raise` | Standing Calf Raise | Standing Calf Raise | הרמת שוקיים עמידה | **הרמת עקבים בעמידה** |

## 2. Merges (same exercise twice → one id)

| Remove id | Keep id | Kept name | Why |
|---|---|---|---|
| `free-chest-press` | `dumbbell-press` | **Dumbbell Bench Press** | Both are "flat dumbbell press on a bench". |
| `v-bar-pull-belly` | `seated-cable-row` | **Seated Cable Row** | Both are the neutral/V-bar seated row. |
| `glute-kick` | `glute-kickback` | **Glute Kickback** | Identical descriptions ("machine or cable kickback"); add a cable version separately (§4). |

Each is one alias line; history for the removed id shows under the kept one.

## 3. Name fixes (rules 2–5, typos, unclear names)

| id | Now | New name | Note |
|---|---|---|---|
| `dumbell-pullover` | Dumbell Pullover | **Dumbbell Pullover** | Typo (the id keeps the typo; harmless). |
| `wide-grip-lat-pulldown` | Wide Grip Lat Pull Down | **Wide-Grip Lat Pulldown** | |
| `close-grip-lat-pulldown` | Narrow Grip Lat Pull Down | **Close-Grip Lat Pulldown** | Matches the id. |
| `wide-pull-belly` | Wide Bar Pull to Belly | **Wide-Grip Seated Row** | |
| `single-arm-lat-pullover` | Single Arm Lat Pullover | **Single-Arm Cable Pullover** | |
| `front-lever-pulldown` | Front-Lever Pulldown | **Straight-Arm Pulldown** | That's what the gym calls it; front lever stays in the description. |
| `one-hand-cable-pushdown` | One Hand Cable Pushdown | **Single-Arm Cable Pushdown** | |
| `medial-one-arm-pull` | Medial One Arm Pull | **Single-Arm Reverse-Grip Pushdown** | ⚠️ Guess from "medial head focus". Confirm what you actually do. |
| `tricep-pushdown` | Rope Pushdown | Rope Pushdown | OK. |
| `overhead-rope-press` | Overhead Rope Extension | **Overhead Cable Extension** | |
| `overhead-press` | Dumbbell Overhead Press | **Dumbbell Shoulder Press** | Pairs with the machine "Shoulder Press". |
| `front-raise` | Single-Arm Front Raise | **Dumbbell Front Raise** | Description says dumbbell; most people do both arms. |
| `ab-cable-crunch` | Abdominal Cable Crunch | **Cable Crunch** | |
| `bicep-dumbbell-curl` | Single-Arm Dumbbell Curl | Single-Arm Dumbbell Curl | Fix description (says "alternating"). |
| `double-arm-bicep-dumbbell-curl` | Double-Arm Dumbbell Curl | **Dumbbell Curl** | Rule 4. |
| `bayesian-curl` | Single-Arm Bayesian Cable Curl | **Single-Arm Bayesian Curl** | |
| `double-arm-bayesian-curl` | Double-Arm Bayesian Curl | **Bayesian Curl** | Rule 4. |
| `biceps-preacher-curl` | Preacher Curl | **EZ-Bar Preacher Curl** | Frees "Preacher Curl" for the machine. |
| `seated-double-arm-preacher-curl` | Seated Double-Arm Preacher Curl | **Preacher Curl** | Machine (rule 1); preacher is always seated. |
| `seated-single-arm-preacher-curl` | Seated Single-Arm Preacher Curl | **Single-Arm Preacher Curl** | |
| `seated-dumbbell-curl` | Seated Dumbbell Curl | **Incline Dumbbell Curl** | The description says incline. |
| `parallels` | Parallel Bars Dip | **Dip** | The common name; `dip` (bench) is renamed below. |
| `weighted-parallels` | Weighted Parallel Bars Dip | **Weighted Dip** | |
| `parallels-assisted` | Assisted Parallel Bar Dip | **Feet-Assisted Dip** | Frees "Assisted Dip" for the machine (§4). |
| `negative-dip` | Negative Parallel Bar Dip | **Negative Dip** | |
| `dip` | Bench Dips | **Bench Dip** | Singular, like the others. |
| `hanging-knee-raise-v3` | Hanging Knee Raise (V3) | **Hanging Knee Raise** | "V3" means nothing to a reader. |
| `hanging-leg-raise` | Hanging Leg Raise | Hanging Leg Raise | Description → straight legs only (knees have their own entry). |
| `wide-row-rear-delt` | Wide Row (Rear Delt) | **Wide-Grip Inverted Row** | It's an inverted row. |
| `torso-extension` | Torso Extension | **Floor Back Extension** | Frees "Back Extension" for the bench (§4). |
| `single-leg-rdl` | Single Leg RDL | **Single-Leg RDL** | Rule 4 spelling. |
| `sl-static-squat-extension` | SL Static Squat Knee Extension | **Single-Leg Static Squat Knee Extension** | |
| `sl-heel-sink`, `sl-jefferson-curl` | Single Leg … | **Single-Leg …** | Hyphen only. |
| `explosive-pullup-progression` | Explosive Pull-Ups / Muscle-Up Progression | **Explosive Pull-Up** | Overlaps `muscle-up-progression`, which already has the ladder. |

### Hebrew-only fixes

| id | Now | New |
|---|---|---|
| `cable-chest-press` | *(missing; shows English)* | **לחיצת חזה בכבל** |
| `dumbbell-lateral-raise` | הרחקות כתף משקולות | **הרחקת כתפיים במשקולות** |
| `cable-lateral-raise` | הרמה צידית כבל | **הרחקת כתפיים בכבל** (same verb as the dumbbell version) |
| `barbell-curl` | כפיפת מרפק מוט | **כפיפת מרפקים במוט** (and use "כפיפת מרפקים" for every curl, not ביספס / כפיפת מרפק mixed) |
| `deadlift` and family | מתה | Keep, and add "דדליפט" as a search word (already in the prototype's synonyms). |

## 4. Missing exercises

Picked for the machines in the prototype gyms first (a tile with nothing on it is
useless), then for common gym moves the library lacks. Names follow the rule.

### Machines with nothing on them yet

| Machine (Technogym) | Add | he |
|---|---|---|
| Selection 900 Arm Extension | **Triceps Extension** | פשיטת מרפקים |
| Pure Strength Seated Dip | **Seated Dip** | מקבילים בישיבה |
| Dip/Chin Assist | **Assisted Dip** | מקבילים בעזרה |
| Pure Strength / Selection Pullover | **Pullover** | פולאובר |
| Pure Strength Seated Calf | **Seated Calf Raise** | הרמת עקבים בישיבה |
| Pure Strength Standing Leg Curl | **Standing Leg Curl** | כפיפת ברך בעמידה |
| Pure Strength Belt Squat | **Belt Squat** | סקוואט חגורה |
| Selection 900 Lower Back / back-extension bench | **Back Extension** | פשיטת גב |
| Selection 900 Upper Back / Reverse Fly | **Rear Delt Fly** (machine) — `reverse-pec-deck` covers it; rename that to **Rear Delt Fly** instead of adding | פרפר הפוך |
| Selection 700 Vertical Traction | **Vertical Traction** → or simply list `wide-grip-lat-pulldown` on it | — |

### Smith machine (today it borrows barbell exercises, which mixes up PRs)

**Smith Squat**, **Smith Bench Press**, **Smith Incline Press**, **Smith Shoulder Press**,
**Smith Lunge**, **Smith Hip Thrust**. Separate ids, because the Smith bar's load isn't
comparable with a free barbell.

### Cable station

| Add | he |
|---|---|
| Straight-Bar Pushdown | פשיטת מרפקים במוט ישר |
| Cable Curl (straight bar) | כפיפת מרפקים בכבל |
| Cable Rear Delt Fly | פרפר הפוך בכבל |
| Cable Glute Kickback | בעיטת ישבן בכבל |
| Cable Pull-Through | פול-ת׳רו בכבל |
| Cable Woodchop | חטיבת עצים בכבל |
| Pallof Press | פאלוף פרס |
| Single-Arm Lat Pulldown | פולי עליון יד אחת |
| Reverse-Grip Lat Pulldown | פולי עליון באחיזה הפוכה |
| Cable Upright Row | חתירה אנכית בכבל |

### Free weights

| Add | he |
|---|---|
| Dumbbell Fly | פרפר במשקולות |
| Decline Bench Press | לחיצת חזה בשיפוע שלילי |
| Close-Grip Bench Press | לחיצת חזה באחיזה צרה |
| Dumbbell Romanian Deadlift | דדליפט רומני במשקולות |
| Reverse Lunge | לאנג׳ אחורי |
| Walking Lunge | לאנג׳ בהליכה |
| Dumbbell Shrug | שראג במשקולות |
| Bent-Over Rear Delt Raise | הרחקה אחורית בהטיה |
| Concentration Curl | כפיפת מרפק בריכוז |
| Reverse Curl | כפיפת מרפקים באחיזה עליונה |
| Dumbbell Overhead Triceps Extension | פשיטת מרפקים מעל הראש במשקולת |
| Kettlebell Swing, Thruster, Burpee | already drafted, commented out in the library; turn them back on |

### Core

Crunch · Decline Sit-Up · Side Plank · Dead Bug · Russian Twist · Captain's Chair Knee Raise.

### Cardio (decide: in or out?)

The gyms have treadmills, bikes, rowers and stair climbers, and the app already has
time-mode sets. Five entries (Treadmill, Bike, Rower, Elliptical, Stair Climber) would let a
workout record warm-up and cardio. They don't fit the volume (kg) stats, so leave
them out unless you want them.

## 5. Library-wide notes

- **About 40 of the 180 entries are mobility, warm-up and jump drills** (90-90, pigeon,
  knee-to-wall, heel sink, pogo, coordination jump…). They belong in the library, but
  they swamp the list. Give them a `mobility` category and show them under their own
  tile/filter instead of mixed in with lifts.
- **Muscle tags have no primary/secondary split.** Add it when the equipment tag is
  added, since both views need it.
- **`push-up-progression` and `handstand-hspu-progression`** are named "Progression",
  but only some of them carry a `progression` ladder (`push-up-progression` has none).
  Either add the ladder or drop "Progression" from the name.
- **The prototype's machine→exercise mapping** (`src/data/gym-machines.ts`) should be
  rewritten after these renames, and become the `equipment` field on each exercise
  in the real version.

## Totals

| Change | Count | Effort |
|---|---|---|
| Drop "Machine" (en + he) | 15 | names only |
| Merges | 3 | names + 3 alias lines |
| Name fixes | ~35 | names only |
| Hebrew-only fixes | 5 | `he.ts` |
| New exercises | ~50 (+5 cardio if wanted) | entries + Hebrew + photo |
