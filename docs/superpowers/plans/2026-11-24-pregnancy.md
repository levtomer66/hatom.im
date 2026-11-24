# Pregnancy (/pregnancy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared pregnancy page (week hero, 40 week cubes with events and reminders, caffeine hero) whose drinks and food are the calories diary's own entries, fed by coffee orders.

**Architecture:** Pure, import-free rules in `src/lib/pregnancy/*.ts` (node:test); one `pregnancies` doc per pregnancy (`src/models/Pregnancy.ts`); routes under `/api/pregnancy`; caffeine is a new `caf` field on calories `Entry`, set by the server. The page reuses calories' Sheet, Ring, SearchBar, amount sheet and `useAutosave`.

**Tech Stack:** Next.js 15 App Router, Mongo native driver, Vercel Blob + sharp, node:test.

**Spec:** `docs/superpowers/specs/2026-11-24-pregnancy-design.md`

## Global Constraints

- All UI copy Hebrew, RTL; dates shown d.m.yyyy; the week is Sunday–Saturday.
- No save buttons: every editor uses `useAutosave` (`src/app/calories/autosave.ts`). The setup card's "להתחיל" is the one button.
- "Today" on the page = device local day after mount; on the server (orders, MCP) = `Asia/Jerusalem` day.
- `src/lib/pregnancy/*.ts` import-free (relative `.ts` imports only), tests import with `.ts`.
- Caffeine limit default 200 mg, range 50–400; amber from 150 mg, red above the limit.
- Doc caps: events ≤ 100, reminders ≤ 30, invites ≤ 10, `done` keeps the last 14 days.
- Pregnant-owner extras (⚠, +kcal, gain tile) only for a caller holding `pregnancy` who owns an active pregnancy.
- Node: `/opt/homebrew/bin/node`; tests `npm test`; build needs `MONGODB_URI=mongodb://127.0.0.1:27018/hatom-shopping-test`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- EDD changed mid-pregnancy → week, cubes, strip, gain band all move; events keep their dates.
- Today before 0+0 or after 42+0 (wrong date typed) → hero says so, cubes/strip don't crash (`dayOfPregnancy` negative / > 294).
- A coffee order retried or placed by MCP and web for the same order id → exactly one diary entry (`order-<id>`).
- A member (not owner) calling diary-writing routes → 403; a member's GET shows only caffeine rows.
- Accepting an invite while already in an active pregnancy → refused with a Hebrew error, not a duplicate-key 500.

---

### Task 1: Dates

**Files:** Create `src/lib/pregnancy/dates.ts`; Test `src/lib/__tests__/pregnancy-dates.test.ts`

**Interfaces — Produces:**
- `type DatingMethod = 'lmp' | 'transfer5' | 'transfer3' | 'us' | 'edd'`
- `eddFrom(method: DatingMethod, date: string, w?: number, d?: number): string | null`
- `dayOfPregnancy(edd: string, today: string): number` (280 − days(edd − today))
- `weekDay(day: number): { w: number; d: number }`; `wdText(day): string` ("12 שבועות ו־3 ימים"; 1 day "ויום", 2 "ויומיים", 0 days → "12 שבועות")
- `trimester(day): 1 | 2 | 3` (≤ 97 → 1, ≤ 195 → 2, else 3)
- `dateOfDay(edd, day): string`; `calendarWeek(date): string[]` (Sun–Sat, 7 dates); `heDate(date): string` ("3.6.2027"); `israelToday(now: Date): string`; `israelHour(now: Date): number`
- `addDays(date, n): string`, `daysBetween(a, b): number` (UTC midnights)

- [ ] **Step 1:** Tests: `eddFrom('lmp','2026-09-01')==='2027-06-08'`; `eddFrom('transfer5','2026-09-15')===addDays('2026-09-15',261)`; `eddFrom('transfer3',…)` +263; `eddFrom('us','2026-11-24',8,2)===addDays('2026-11-24',280-58)`; `eddFrom('edd','2027-06-08')` same; invalid date → null; `w>42` → null. `dayOfPregnancy('2027-06-08','2027-06-08')===280`; `weekDay(87)` → `{w:12,d:3}`; `wdText(86)==='12 שבועות ויומיים'`, `wdText(87)==='12 שבועות ו־3 ימים'`; `wdText(84)==='12 שבועות'`; `trimester(97)===1`, `trimester(98)===2`, `trimester(196)===3`; `calendarWeek('2026-11-25')[0]==='2026-11-22'` (a Sunday) and length 7; `heDate('2027-06-03')==='3.6.2027'`; `israelToday(new Date('2026-11-24T22:30:00Z'))==='2026-11-25'`.
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Implement with `Date.UTC` math; Israel day/hour via `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' })`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(pregnancy): date math — EDD from LMP/transfer/scan, w+d, trimester`.

### Task 2: Schedule, reminders, today's strip

**Files:** Create `src/lib/pregnancy/schedule.ts`; Test `src/lib/__tests__/pregnancy-schedule.test.ts`

**Interfaces — Consumes:** Task 1. **Produces:**
- `type SuggestionId` and `SUGGESTIONS: { id; name; from: number; to: number; why: string }[]` — the spec's table verbatim (weeks inclusive).
- `interface PEvent { id; title; date; time?: string; note?: string; kind: 'custom' | SuggestionId; remindBefore: boolean }`
- `interface Reminder { id; text; repeat: 'once' | 'daily' | 'weekdays'; date?: string; days?: number[]; done: string[] }`
- `openSuggestions(events: PEvent[], dismissed: SuggestionId[]): Suggestion[]` (not booked, not dismissed)
- `dueOn(r: Reminder, date: string): boolean`
- `todayStrip(p: { edd; events; reminders; dismissed }, today: string): StripItem[]` with `StripItem = { kind: 'event' | 'tomorrow' | 'reminder' | 'window'; id: string; text: string; time?: string; done?: boolean }` — order: events today (by time), reminders, tomorrow's events with remindBefore, suggestions whose window starts this pregnancy week.
- `markDone(r: Reminder, date: string, done: boolean, today: string): Reminder` (keeps dates within 14 days before today)
- `weekMarks(p, week: number): { events: number; windows: number }` for cube dots.

- [ ] **Step 1:** Tests: booking `nt` removes it from `openSuggestions`; deleting that event brings it back; `dueOn` once/daily/weekdays (`days:[0,1,2,3,4]` true on a Sunday, false on Saturday); `todayStrip` lists a tomorrow event only when `remindBefore`; a window item appears in week 11 for `nt` and not in week 12; `markDone` drops a 15-days-old date and toggles today; `weekMarks` counts.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(pregnancy): suggested MoH schedule, reminders, today's strip`.

### Task 3: Drinks, caffeine rules, food safety

**Files:** Create `src/lib/pregnancy/drinks.ts`, `src/lib/pregnancy/safety.ts`; Test `src/lib/__tests__/pregnancy-drinks.test.ts`

Values: from the research note `pregnancy-caffeine-sources.md` in the shared notes folder (each drink's mg with its source URL as a comment).

**Interfaces — Produces:**
- `interface Drink { id: string; name: string; emoji: string; unit: string; mg: number; nu: { kcal; p; c; f } }`; `DRINKS: Drink[]` (ids: `espresso`, `espresso-double`, `hafuch-small`, `hafuch-large`, `capsule-vanille`, `capsule-hazelnut`, `capsule-blonde`, `capsule-caramel`, `capsule-guatemala`, `instant`, `black`, `iced`, `decaf`, `tea-black`, `tea-green`, `cola`, `zero-glass`, `zero-can`, `energy`, `dark-choc`, `shoko`).
- `drinkById(id): Drink | null`; `matchDrink(text: string): Drink | null` (Hebrew name contains, best match).
- `cafPer100(name: string): number | null` (mg per 100 g/ml; longest matching stem wins; decaf/נטול → ~1).
- `orderDrink(o: { drink; milk; sugar; source; capsule; vanillaPumps; caramelPumps }): { drink: Drink; mg: number; nu: Totals }` — spec § Coffee orders mapping.
- `cafLevel(mg, limit): 'ok' | 'warn' | 'over'` (warn ≥ 150, over > limit).
- `safety.ts`: `foodWarning(name: string): string | null` (Hebrew reason).

- [ ] **Step 1:** Tests: `drinkById('hafuch-large').mg` equals the researched value; `matchDrink('הפוך גדול')?.id==='hafuch-large'`; `cafPer100('קוקה קולה זירו 1.5 ליטר')` = zero-cola value; `cafPer100('מים מינרליים')===null`; `cafPer100('קפה נטול קפאין')` ≤ 2; `orderDrink` tomer-coffee cappuccino vanille → mg = `capsule-vanille.mg`, kcal includes milk, +16 per sugar, +20 per pump; café cappuccino → `hafuch-small`; espresso no milk kcal ≤ 5; `cafLevel(150,200)==='warn'`, `cafLevel(201,200)==='over'`; `foodWarning('סושי סלמון')` non-null, `foodWarning('גבינה צהובה')===null`, `foodWarning('בירה שחורה')` non-null, `foodWarning('כבד עוף')` non-null.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(pregnancy): built-in drinks with sourced caffeine, name rules, food-safety stems`.

### Task 4: Sizes, stages, weight gain, the pregnancy doc rules

**Files:** Create `src/lib/pregnancy/sizes.ts`, `stages.ts`, `gain.ts`, `pregnancy.ts`; Test `src/lib/__tests__/pregnancy-core.test.ts`

Data: `pregnancy-weeks-and-images.md` in the shared notes folder (size table weeks 4–40 with its reference; Commons illustration URLs with author + license).

**Interfaces — Produces:**
- `sizeFor(week): { fruit: string; emoji: string; cm: number; g: number } | null` (null < 4; > 40 → week 40).
- `stageFor(week): { img: string; page: string; author: string; license: string; week: number }` (nearest week).
- `gainBand(preKg, heightCm): { lo: number; hi: number; rateLo: number; rateHi: number; bmi: number }` (IOM 2009 bands per spec; weekly rates: under 0.44–0.58, normal 0.35–0.50, over 0.23–0.33, obese 0.17–0.27).
- `bandAt(band, day): { lo; hi }` (0.5–2 kg reached linearly by day 97, then + rate × weeks).
- `gainVerdict(preKg, heightCm, kgNow, day): { gain: number; lo; hi; verdict: 'in' | 'over' | 'under' }`.
- `extraKcal(day): 0 | 340 | 450` (by trimester).
- `pregnancy.ts`: `interface Pregnancy` (spec § Data, `id: string` instead of `_id`), `parseSetup(v): Result<{ dating; edd; preKg; heightCm }>`, `parsePatch(v): Result<Partial<{ dating; edd; preKg; cafLimit }>>`, `parseEvent(v)`, `parseReminder(v)`, `canInvite(p, email): Result<true>` (not a member, not invited, ≤ 10; the email checked with `parseInviteEmail` imported from `../shopping/household.ts`), caps constants `MAX_EVENTS = 100`, `MAX_REMINDERS = 30`, `MAX_INVITES = 10`.

- [ ] **Step 1:** Tests: `sizeFor(3)===null`, `sizeFor(12)` has fruit; `stageFor(13).week` is the nearest available; `gainBand(60,165)` → normal band 11.5–16; `gainVerdict(60,165,61,90).verdict==='in'`; `gainVerdict(60,165,70,100).verdict==='over'`; `extraKcal(97)===0`, `extraKcal(98)===340`, `extraKcal(196)===450`; `parseSetup` rejects a future LMP > today and an EDD > 300 days ahead, accepts LMP and returns its EDD; `parsePatch({cafLimit:40})` fails, `{cafLimit:250}` ok; `parseEvent` rejects bad time `'25:00'`, title > 80 chars.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(pregnancy): size table, stage illustrations, IOM weight gain, doc validation`.

### Task 5: Calories entries carry caffeine

**Files:** Modify `src/lib/calories/calories.ts`, `src/lib/calories/api-types.ts`; Test `src/lib/__tests__/calories-core.test.ts`

**Interfaces — Produces:**
- `Ref.kind` adds `'drink'`; `Entry` adds `caf?: number`, `order?: string`; `base` adds `caf?: number`; `MealItem` adds `caf?: number`; `FoodHit.source` adds `'drink'`; `FoodHit` adds `caf?: number` (per unit for drinks, per 100 for products).
- `rescaleEntry` scales `caf` from `base.caf`.
- `dayCaf(entries: Entry[]): number`.
- `recommend(p, aim, kg, year, extra = 0)` adds `extra` to the goal before rounding.
- `parseEntry` accepts `kind: 'drink'` (a key) and, for `quick` only, `caf` 0–1000 (integer).

- [ ] **Step 1:** Tests: rescale doubles `caf` (65 → 130 at qty 2, from base, no compounding after 2→3→1); `dayCaf` sums, skipping entries without caf; `recommend(…, 340)` = old + 340 (rounded to 50); `parseEntry` with `ref:{kind:'drink',key:'espresso'}` ok; a product entry's client `caf` is dropped; quick with `caf:2000` fails.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS (old calories tests too).
- [ ] **Step 5:** Commit `feat(calories): entries carry caffeine (caf), drink refs, recommend takes an extra`.

### Task 6: Model, permission, gate helpers

**Files:** Create `src/models/Pregnancy.ts`, `src/app/api/pregnancy/_shared.ts`; Modify `src/types/permissions.ts` (`pregnancy`, 🤰 "Pregnancy", after `calories`), `src/middleware.ts` (pattern + matcher `/pregnancy/:path*`), `src/app/page.tsx` (tile: icon `FaBaby`, "מעקב הריון", "שבוע, תורים וקפאין", `/pregnancy`, "לדף", permission `pregnancy`), `src/components/Navbar.tsx` ("הריון"), `src/app/api/calories/_shared.ts`.

**Interfaces — Produces:**
- Model: `pregnancyFor(email): Promise<Pregnancy | null>` (active, member); `invitesFor(email): Promise<{ id; owner; by }[]>`; `createPregnancy(owner, setup)`; `patchPregnancy(id, patch)`; `addEvent/updateEvent/deleteEvent(id, …)`; `addReminder/updateReminder/deleteReminder/setDone`; `dismiss(id, sid, on)`; `invite(id, email, by)`, `cancelInvite`, `acceptInvite(id, email): Promise<'ok' | 'busy' | 'gone'>`, `declineInvite`; `setScan(id, week, scan): Promise<string | null>` (returns the replaced URL); `deleteScan`; `endPregnancy(id)`. Indexes: unique `members` partial `{status:'active'}`, `invites.email`. Every write `$set: { updatedAt }` and enforces the caps in its filter.
- `_shared.ts`: `requirePregnancyCaller(request): Promise<{ caller; p: Pregnancy | null } | NextResponse>`; `isOwner(p, email)`.
- `pregnantOwner(email): Promise<Pregnancy | null>` (active and `owner === email`; permission checked by caller).
- calories `_shared.ts`: `requireDiaryCaller(request): Promise<FeatureCaller | NextResponse>` — `calories` first; on 403, `pregnancy` + `pregnantOwner`. Swap it into calories routes `day`, `search`, `product`, `label`, `meals`, `settings`, `weight`.

- [ ] **Step 1:** `npx tsc --noEmit --incremental false --pretty false` and `npm run lint` clean.
- [ ] **Step 2:** Commit `feat(pregnancy): permission, model, gates; calories routes accept the pregnant owner`.

### Task 7: Pregnancy API

**Files:** Create `src/app/api/pregnancy/route.ts`, `events/route.ts`, `reminders/route.ts`, `reminders/done/route.ts`, `invites/route.ts`, `invites/accept/route.ts`, `dismiss/route.ts`, `scans/route.ts`, `drink/route.ts`, `me/route.ts`; Modify `src/lib/pregnancy/pregnancy.ts` (response types).

**Interfaces — Produces** (`src/lib/pregnancy/pregnancy.ts`):
- `GET /api/pregnancy?date&today` → `PregnancyState = { role: 'none' | 'owner' | 'member'; p: Pregnancy | null; invites: {id; owner; by}[]; caf: { mg: number; limit: number; rows: { id; name; emoji: string; mg; at; meal }[] } | null; kcal: { eaten: number; goal: number } | null /* owner only */; gain: GainView | null /* owner only */; canCoffee: boolean }`.
- `POST /api/pregnancy` setup (refuses when already in one: 409 "כבר יש הריון פעיל"); `PATCH` (members) `parsePatch`; `cafLimit` owner only.
- `events` POST/PATCH/DELETE `{id}`; `reminders` same; `reminders/done` `{ id, date, done }`; `dismiss` `{ sid, on }`.
- `invites` POST `{email}` (owner), DELETE `{email}`; `invites/accept` POST `{id, accept: boolean}` → 409 "את/ה כבר בהריון אחר" on `busy`.
- `scans` POST multipart `{week, file}` (sharp 1600 px, JPEG 0.82, `put` public; `del` the replaced blob), DELETE `{week}`.
- `drink` POST `{ id, date, qty?, meal? }` (owner) → `addEntry` with `ref:{kind:'drink'}`, `caf`, `nu`, unit = drink unit, returns the entry.
- `me` GET → `{ gain: GainView; cafToday: number; limit: number } | null` (for pregnant owner; null otherwise, never 403 for a signed-in user).
- `GainView = { gain; lo; hi; verdict; log: { d; kg }[]; preKg; band: { day; lo; hi }[] }`.

- [ ] **Step 1:** Add `.claude/launch.json` entry `pregnancy-local` (`npm run dev:local -- -p 3140`), start it with preview_start, exercise each route with `fetch` from the page console (setup → GET → event → reminder done → invite → second user can't write the diary).
- [ ] **Step 2:** tsc + lint clean. **Step 3:** Commit `feat(pregnancy): API — state, setup, events, reminders, invites, scans, drinks`.

### Task 8: Calories routes set caffeine; pregnancy extras in the day

**Files:** Modify `src/app/api/calories/day/route.ts`, `src/app/api/calories/search/route.ts`, `src/app/api/calories/meals/route.ts`, `src/lib/calories/api-types.ts`.

**Interfaces — Produces:**
- Day POST: server sets `entry.caf` (drink → `drinkById × qty`; product/food → `cafPer100(name) × grams/100`, rounded; meal → `getMeal` items' caf × qty; quick → parsed value) and `base.caf`.
- Day GET: `DayResponse.preg: { day: number; extra: number; trimester: 1|2|3 } | null` for the pregnant owner; while `followRec`, `recommend(..., extra)`.
- Search: drinks matching the query first (`source: 'drink'`, `per` = one unit's totals and `units: [{ name: drink.unit, g: 1 }]`, logged like a home-made meal's portion).
- Meals save: each item gets `caf` from the same rules.

- [ ] **Step 1:** Local check: log "הפוך גדול" via search on /calories → entry has `caf`; qty 2 → doubled; GET day as pregnant owner has `preg.extra`.
- [ ] **Step 2:** tsc + lint. **Step 3:** Commit `feat(calories): server-set caffeine, drinks in search, pregnancy extra in the goal`.

### Task 9: Coffee orders log to the diary

**Files:** Create `src/lib/coffee-caffeine.ts` (`logCoffeeOrder(order: CoffeeOrder): Promise<void>`); Modify `src/app/api/coffee-order/orders/route.ts` (both paths), `src/app/api/mcp/route.ts` (`order_coffee`), `src/app/coffee-order/page.tsx` (the "אחרי הקפה" line from `GET /api/pregnancy/me` + `orderDrink` mg of the form's config, coloured by `cafLevel`).

- `logCoffeeOrder`: `pregnantOwner(order.userEmail)` and `hasCurrentPermission(…, 'pregnancy')`, else return; date/meal from `israelToday`/`israelHour` of `scheduledAt ?? createdAt`; entry id `order-<id>`, skipped if it exists (`addEntry` filter `entries.id: { $ne }`); name `"<drinkSummary> ☕"`; runs in `after()`, catches and logs.

- [ ] **Step 1:** Local: as pregnant owner place a web order → one entry; call the logger twice → still one.
- [ ] **Step 2:** tsc + lint. **Step 3:** Commit `feat(coffee-order): a pregnant owner's orders log their caffeine to the diary`.

### Task 10: The /pregnancy page

**Files:** Create `src/app/pregnancy/{layout.tsx,page.tsx,api.ts,pregnancy.css,Setup.tsx,WeekHero.tsx,StageSheet.tsx,TodayStrip.tsx,CaffeineHero.tsx,DrinksRow.tsx,WeekCubes.tsx,WeekSheet.tsx,EventSheet.tsx,ReminderSheet.tsx,GainTile.tsx,SettingsSheet.tsx}`.

Layout (spec § The week / calendar / caffeine): head (‹ date › ⚙) · invite cards · WeekHero (ring of 280, `12+3`, wdText, trimester · עוד N ימים · EDD, size line → StageSheet with scan upload) · TodayStrip · CaffeineHero (Ring-style mg, `cafLevel` colours) · DrinksRow (owner: one tap → POST drink, undo toast) · caffeine rows (owner: swipe delete via calories DELETE, tap → calories EditSheet) · SearchBar (owner; picks → calories AddSheet; ⚠ via `foodWarning`) · kcal chip → `/calories` · GainTile · WeekCubes (10 per row, trimester bands, dots from `weekMarks`) → WeekSheet (Sun–Sat, ‹ ›, w+d per day, highlights, tap day → EventSheet) · "להזמין קפה ☕" when `canCoffee`. Setup when `role:'none'`: method chips, date (+ w/d for scan), pre-pregnancy kg, height → "להתחיל". SettingsSheet: dating (autosave), preKg, limit (owner), members + invite field, "הלידה הייתה 🎉" (confirm). Members see the caffeine hero read-only. Midnight roll as in calories (`rollToday`).

- [ ] **Step 1:** Start `pregnancy-local`, phone width (375×812): setup → hero shows the right w+d; tap fruit → stage sheet; add event from a week sheet day; reminder tick on the strip; drink tap → ring moves and the entry shows on /calories; a search pick logs food. Screenshot each.
- [ ] **Step 2:** tsc + lint + `npm test`. **Step 3:** Commit `feat(pregnancy): the page — week hero, strip, caffeine, week cubes, settings`.

### Task 11: Extras in /calories and /workout

**Files:** Modify `src/app/calories/page.tsx` (⚠ chip and "☕ N מ״ג" in entry rows; GainTile beside Weight when `preg`), `src/app/calories/search-parts.tsx` + `AmountStep.tsx` (⚠ on hits and the amount sheet when `preg`), `src/app/calories/SettingsSheet.tsx` (goal card "כולל +340 לשליש שני" when followRec and extra > 0), `src/app/workout/page.tsx` (GainTile above templates, from `/api/pregnancy/me`, only when `hasPermission(session,'pregnancy')`).

- [ ] **Step 1:** Local at phone width: pregnant owner sees ⚠ on "סושי", the goal note, the tile on both pages; a second user with `pregnancy` + `calories` (member) sees none of them.
- [ ] **Step 2:** tsc + lint. **Step 3:** Commit `feat(calories,workout): pregnant owner's food warnings, goal extra and weight-gain tile`.

### Task 12: MCP tools and docs

**Files:** Create `src/lib/pregnancy/mcp-tools.ts`; Modify `src/app/api/mcp/route.ts` (spread with permission `pregnancy`), `CLAUDE.md` (route row + `### Pregnancy (/pregnancy)` section: one log in caloriesDays with server-set caf; suggestions are constants; one active pregnancy per person; owner-only extras; coffee order → `order-<id>` entry), `docs/shopping-api.md` only if it lists MCP tools.

- `pregnancy_status` (no args) → Hebrew text: w+d, trimester, days left, caffeine today/limit, today's strip.
- `pregnancy_log_drink` `{ drink: string; qty?: number }` → `matchDrink`, owner only, Israel today, `defaultMeal(israelHour)`; returns "נרשם: הפוך גדול · 130 מ״ג · היום 195/200".

- [ ] **Step 1:** Local: `tools/list` contains both; call each through `/api/mcp` with a local API key.
- [ ] **Step 2:** tsc + lint + `npm test` + `MONGODB_URI=… npm run build`. **Step 3:** Commit `feat(pregnancy): MCP status + log-drink tools; CLAUDE.md`.
