# Pregnancy (/pregnancy): week, calendar, caffeine

A sibling of /calories for following a pregnancy. Hebrew, RTL, phone-first,
Israeli dates and data, no save buttons (every editor autosaves through
calories' `useAutosave`). Designed with the owner in a grilling session on
2026-11-24; the decisions below are theirs.

## What the owner asked for

- A **week hero**: "12+3", trimester, days to go, and a baby-size fruit you
  tap to see the stage (an illustration, or your own scan).
- A **calendar** of week cubes with events and reminders.
- A **caffeine counter** (second hero, mg) with one-tap drinks (הפוך קטן,
  הפוך גדול, כוס זירו…), shared two-way with the calories diary, and fed by
  the coffee-order app.
- Food can be added from /pregnancy too (it lands in the calories diary).

## Access

- Route `/pregnancy`, permission **`pregnancy`** (🤰, after `calories` in
  `PERMISSION_KEYS`), middleware pattern + matcher, a home tile and a nav entry.
- **A pregnancy is its creator's own.** Whoever sets it up is the pregnant
  one, the *owner*. Others join only by her invite (⚙ → משתתפים), accepted on
  a card at /pregnancy, as with shopping households. A person is in at most one
  active pregnancy. Every member needs the `pregnancy` permission.
- The **owner** logs food and caffeine. **Members** see her caffeine for the
  day (drink names and mg only, never the rest of her diary) and can edit
  events, reminders, the due date and scans.
- **"Pregnant owner"** = holds `pregnancy` and owns an active pregnancy. Only
  she gets the extras in other apps (⚠ food chips, the pregnancy calorie
  goal, the weight-gain tile). A member never does, even with the permission.
- "הלידה הייתה 🎉" (⚙, owner only) sets `status: 'ended'`: the doc is kept,
  hidden, and no longer counts as active, so a later pregnancy starts fresh.

## The week

- One stored **due date (EDD)**. The setup sheet and ⚙ set it from any of:
  - **LMP** (first day of the last period): EDD = LMP + 280.
  - **IVF transfer**, day-5 embryo: transfer + 261; day-3: transfer + 263.
  - **Ultrasound**, "w+d on date": EDD = date + (280 − (7w + d)).
  - **The EDD itself**.
  The method and the date typed are kept (`dating`) so ⚙ shows what was
  entered. Changing it is allowed any time (doctors re-date after a scan).
- Day of pregnancy = 280 − (EDD − today), in days. **w+d** = ⌊day/7⌋ + day mod 7.
  Today is the device's local day, computed after mount.
- **Hero**: big `12+3`, under it "12 שבועות ו־3 ימים". A line: trimester
  (שליש ראשון ≤ 13+6, שני 14+0–27+6, שלישי 28+0+), "עוד 193 ימים",
  "תאריך משוער 3.6.2027" (Israeli d.m.yyyy). A ring of the 280 days.
  Before 0+0 or past 42+0 the hero says so instead.
- **Size**: from week 4, "בגודל של אבוקדו 🥑 · 11.6 ס״מ · 100 ג׳" from a
  Hebrew table (weeks 4–40, length and weight from a cited growth reference).
  Tapping it opens the **stage sheet**: an illustration of that stage (freely
  licensed Wikimedia Commons, hot-linked, with author and license credit,
  nearest week when that week has none). No specimen photos. When a member
  has uploaded a scan for that week, the scan is shown first, with the
  illustration under it.
- **Scans**: in the stage sheet, "📷 העלאת סריקה". Resized server-side with
  sharp (1600 px long edge, JPEG 0.82, metadata stripped), stored in Vercel
  Blob as `pregnancy/<id>/<week>-<uuid>.jpg`, one per week. Replacing one
  deletes the old blob. Only the URL is in the doc.

## The calendar

- **40 cubes**, one per pregnancy week, in rows of 10 with the trimester as a
  colour band. Past weeks filled, the current one highlighted (pulsing ring),
  a dot on weeks with an event and a hollow dot on weeks with a suggested
  window not yet booked.
- Tapping a cube opens the **week sheet**: the Israeli calendar week **Sunday
  to Saturday** that holds that pregnancy week's first day, with ‹ › to the
  calendar week before and after. Each day shows its date and its `w+d`.
  Highlighted: the day the pregnancy week turns (`w+0`), today, and days with
  events. Days of the tapped pregnancy week are tinted. Tapping a day adds an
  event on it.
- **Suggested events** (Israeli MoH routine, `SUGGESTIONS` in
  `src/lib/pregnancy/schedule.ts`, each with a window in weeks and a short
  why). Working list:
  | id | name | weeks |
  |---|---|---|
  | `first-visit` | פתיחת תיק הריון ובדיקות דם | 6–10 |
  | `heartbeat` | אולטרסאונד דופק | 6–9 |
  | `nt` | שקיפות עורפית + סקר שליש ראשון | 11–13 |
  | `early-scan` | סקירה מוקדמת | 14–17 |
  | `triple` | חלבון עוברי (תבחין משולש) | 16–20 |
  | `late-scan` | סקירה מאוחרת | 19–25 |
  | `gct` | העמסת סוכר | 24–28 |
  | `anti-d` | אנטי D (אם Rh שלילי) | 28 |
  | `tdap` | חיסון שעלת | 27–36 |
  | `gbs` | תרבית GBS (לפי המלצה) | 35–37 |
  | `monitor` | מוניטור | 40 |
  A suggestion shows as a ghost row on the cubes of its window until a date
  is set ("לקבוע תאריך" turns it into an event with `kind: <id>`) or it is
  dismissed ("לא רלוונטי"). Deleting an event made from a suggestion brings
  the suggestion back. A suggestion is a constant, never copied into the doc.
- **Events**: title, date, optional time, optional note, and "תזכורת יום
  לפני" (on by default). Anyone in the pregnancy can add, edit or delete them.
- **Reminders** (in-page only, no push): a one-off (date + text), daily, or
  on chosen weekdays (e.g. ויטמינים א׳–ה׳). Ticked done per day.
- **"היום" strip** under the week hero: today's events, reminders due today,
  "מחר: <event>" for tomorrow's events with the day-before reminder on, and
  suggestions whose window opens this week. Ticking a reminder stores the
  date in its `done` list (only the last 14 days are kept).

## Caffeine, and food, in the calories diary

**One log.** Caffeine is a field of the calories diary's entries, so a drink
logged on either page is the same entry in `caloriesDays`, and deleting it
anywhere removes it everywhere.

- `Entry` gains `caf?: number` (mg for the logged amount, frozen with the rest
  of the totals; `base.caf` too, so a qty edit rescales it) and an optional
  `order?: string` (coffee-order id). `Ref.kind` gains `'drink'` (key = a
  built-in drink id).
- **The server sets `caf`**, never trusting a client value, except on a quick
  entry, where the typed mg is the value ("קפאין חופשי"):
  - `drink` → the built-in table × qty;
  - `product` / `food` → `cafPer100(name)`, name rules on catalog and MoH
    names (cola, זירו/דיאט cola, משקה אנרגיה, אייס קפה/קפה קר, קפה, תה,
    שוקו…; longest stem wins) × grams / 100, else none;
  - `meal` → the sum of its items' `caf` when the meal was saved (items gain
    `caf?`).
- **Built-in drinks** (`DRINKS` in `src/lib/pregnancy/drinks.ts`, import-free):
  each one has an id, a Hebrew name, an emoji, a unit (כוס / פחית / שוט / קפסולה),
  mg per unit, and kcal/p/c/f per unit, with the source of the mg value in a
  comment. The working list is the table agreed in the grilling (אספרסו
  קצר/כפול, הפוך קטן/גדול, קפסולה per coffee-order capsule, נס קפה, שחור/טורקי,
  קפה קר, נטול, תה שחור/ירוק, קולה, כוס זירו, פחית זירו, משקה אנרגיה, שוקולד
  מריר, שוקו), each value checked against a source before it ships. In
  calories they log like any entry. Search hits include them (`source:
  'drink'`) on both pages.
- **Caffeine hero** (/pregnancy): a ring of mg against the limit (default 200,
  editable 50–400 in ⚙): green, amber from 150, red over 200 (the limit). Under
  it: "N מ״ג · נשארו M", then the **drinks row** (horizontal chips, one tap logs
  one unit to today at `defaultMeal(hour)`, with an undo toast), and the day's
  caffeine entries (swipe to delete, tap to edit the qty or the meal).
  ‹ › day arrows above the hero, like calories.
- **Food from /pregnancy**: calories' `SearchBar` and scanner under the drinks
  row. Picks open calories' amount sheet and log to the diary. Under them, a
  chip "קלוריות היום 1,240 / 2,300 ←" links to /calories for the day.
- **Access**: the calories routes the page uses (day, search, product, label)
  accept a caller who holds `calories` **or** is a pregnant owner
  (`requireDiaryCaller`). The owner doesn't need `calories` granted separately.
- Members' read: `GET /api/pregnancy` returns the owner's caffeine entries for
  the asked date (name, emoji, mg, time) and the total, nothing else.
- **On /calories** entries with caffeine show "☕ 65 מ״ג" in their row.

## Coffee orders

- When a **pregnant owner** places an order (web form, Shortcut/API key, MCP
  `order_coffee`), the order is logged to her diary at once: one entry
  "<drink summary> ☕", `ref: { kind: 'drink', key: <mapped drink> }`,
  `order: <orderId>`, entry id `order-<orderId>` (idempotent).
  - Date and meal: Israel time (`Asia/Jerusalem`) of now, or of `scheduledAt`
    for a scheduled order.
  - mg: Tomer's machine (`source: 'tomer-coffee'`) → the capsule's mg; a café
    → the café drink (espresso → אספרסו קצר, lungo → אספרסו כפול, cappuccino →
    הפוך קטן, iced → קפה קר). kcal: the drink's own, with milk counted only
    when milk ≠ none, + 16 per sugar spoon + 20 per syrup pump.
  - The entry is an ordinary diary entry: the owner deletes it if the coffee
    never came.
  - One helper, `logCoffeeOrder(order)`, run in `after()` from all three order
    paths; a failure is logged, never fails the order.
- On /coffee-order, for a pregnant owner, the confirm area shows "אחרי הקפה:
  180 / 200 מ״ג" (today's mg + this order's), amber or red past the thresholds.
- /pregnancy has a "להזמין קפה ☕" link to /coffee-order when the caller has
  `coffee-order`.

## Extras for the pregnant owner, in other apps

- **⚠ food safety**: `foodWarning(name)` (pure, Hebrew stems → a reason): sushi
  and raw fish (סושי, סשימי, דג נא), unpasteurized/soft cheeses (לא מפוסטר,
  ברי, קממבר, גורגונזולה, רוקפור), raw eggs (מיונז ביתי, ביצה עין רכה, טירמיסו),
  liver and pâté (כבד, פטה), alcohol (יין, בירה, וודקה…), and high-mercury fish
  (טונה אדומה, חרב, כריש). A ⚠ chip on search hits, the amount sheet and the
  entry row, with the reason on tap. A warning only, nothing blocked. On
  /pregnancy and on /calories, for her only.
- **Calorie goal**: while `followRec`, `recommend()` adds the trimester's extra
  (0 / +340 / +450). The goal card says "כולל +340 לשליש שני". A typed goal
  stays as typed.
- **Weight gain**: from `preKg` (asked at setup, prefilled from the latest
  weigh-in) and the height (calories profile's `heightCm`, else asked at
  setup and saved to her calories profile). The pre-pregnancy BMI picks the
  IOM 2009 band: <18.5 12.5–18 kg, 18.5–24.9 11.5–16, 25–29.9 7–11.5, ≥30 5–9.
  The band by week: 0.5–2 kg by 13+6, then the band's weekly rate to 40+0.
  The tile shows "+4.2 ק״ג · בטווח" (or "מעל" / "מתחת"). Tapping it opens a
  sheet with the weigh-ins since the pregnancy started against the band (an
  SVG line). It's shown on /pregnancy, on /calories (beside the weight card) and on
  /workout (the home screen, above the templates), through one read,
  `GET /api/pregnancy/me`, which answers `{ gain }` or `null`. Weight stays the
  workout app's single value. The weigh-ins are calories' existing log.

## Data (Atlas M0)

One collection, **`pregnancies`**, one small doc per pregnancy:

```ts
{
  _id: ObjectId,
  owner: string,                // the pregnant one's email
  members: string[],            // owner first; partial unique index where status 'active'
  invites: { email: string; by: string; at: string }[],   // ≤ 10
  status: 'active' | 'ended', endedAt?: string,
  edd: 'YYYY-MM-DD',
  dating: { method: 'lmp' | 'transfer5' | 'transfer3' | 'us' | 'edd'; date: string; w?: number; d?: number },
  preKg: number | null,
  cafLimit: number,             // mg, default 200
  events: { id; title; date; time?: 'HH:MM'; note?; kind: 'custom' | SuggestionId; remindBefore: boolean }[],   // ≤ 100
  reminders: { id; text; repeat: 'once' | 'daily' | 'weekdays'; date?; days?: number[]; done: string[] }[],     // ≤ 30
  dismissed: SuggestionId[],
  scans: Record<string /* week */, { url: string; at: string; by: string }>,
  createdAt: string, updatedAt: string,
}
```

Unique index on `members` with `partialFilterExpression: { status: 'active' }`
(one active pregnancy per person); an index on `invites.email`. The calories
changes add `caf`/`order` to entries and `'drink'` to refs: no new collection.

## Code layout

- `src/lib/pregnancy/*.ts`, import-free, tested with `node --test`:
  `dates.ts` (EDD from each method, day/w+d, trimester, the Sun–Sat week,
  Israel dates), `schedule.ts` (suggestions, today's strip, reminders due,
  done-pruning), `sizes.ts` (weeks 4–40), `stages.ts` (illustrations by week
  with credit), `drinks.ts` (DRINKS, `cafPer100`, coffee-order mapping),
  `safety.ts` (`foodWarning`), `gain.ts` (BMI band, the band by week, the
  tile's verdict), `pregnancy.ts` (types, parse/validate every write,
  invites, `extraKcal(week)`).
- `src/models/Pregnancy.ts`: typed functions (`pregnancyFor(email)`,
  `createPregnancy`, `updatePregnancy`, events/reminders/invites/scans ops,
  `endPregnancy`), one active per person.
- Routes under `src/app/api/pregnancy/`: `route.ts` (GET the page's state for
  a date: pregnancy, role, my invites, owner's caffeine; POST setup; PATCH due
  date, preKg, limit), `events`, `reminders` (+ done), `invites` (+ accept,
  decline), `scans` (upload, delete), `me` (the gain tile for other apps),
  `drink` (POST: log one built-in drink, the one-tap path). Shared glue
  in `src/app/api/pregnancy/_shared.ts`.
- `requireDiaryCaller` in `src/app/api/calories/_shared.ts`, used by the
  calories routes in place of `requireFeatureCaller(…, 'calories')`.
- Page `src/app/pregnancy/` (`page.tsx`, `WeekHero`, `TodayStrip`,
  `CaffeineHero`, `DrinksRow`, `WeekCubes`, `WeekSheet`, `EventSheet`,
  `StageSheet`, `GainTile` (also imported by /calories and /workout),
  `SettingsSheet`, `Setup`), wearing `shopping.css` + `calories.css` +
  `pregnancy.css`, reusing calories' `Sheet`, `Ring`, `SearchBar`, amount sheet and
  `useAutosave`.
- **MCP** (`src/lib/pregnancy/mcp-tools.ts`, permission `pregnancy`):
  `pregnancy_status` (w+d, trimester, days to go, today's caffeine vs limit,
  today's strip) and `pregnancy_log_drink` (free-text drink → best match in
  DRINKS, optional qty; owner only; Israel's today).
- CLAUDE.md gets a `/pregnancy` row and a feature section.

## Not in scope

Push or ntfy reminders (in-page only for now), kick counting, contraction
timer, a baby log after birth, sharing with /calendar, editing someone
else's diary.
