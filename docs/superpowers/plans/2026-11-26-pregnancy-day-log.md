# Pregnancy Day Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let everyone in a pregnancy log mood, symptoms, measurements and notes on a day, and read the history in the 40 week cubes and the week sheet.

**Architecture:** Pure rules in an import-free `src/lib/pregnancy/daylog.ts` (registries, parsing, summary). One doc per pregnancy and day in a new `pregnancyDays` collection, accessed through typed functions in `src/models/PregnancyDay.ts`. Routes under `/api/pregnancy/days`. A `DaySheet` and a compact `DayLogRow` in `src/app/pregnancy/DayLog.tsx`, wired into the week sheet, the "היום" strip and the cubes.

**Tech Stack:** Next.js 15 App Router, TypeScript, MongoDB driver (no ODM), `node --test`, calories' `Sheet` and `useAutosave`.

**Spec:** `docs/superpowers/specs/2026-11-26-pregnancy-day-log-design.md`. The base feature is `docs/superpowers/specs/2026-11-24-pregnancy-design.md`.

## Global Constraints

- Mood 1–5 as 😣 😕 😐 🙂 😄.
- Symptom ids, in this order, never renamed: `nausea` בחילה, `vomit` הקאות, `heartburn` צרבת, `tired` עייפות, `back` כאבי גב, `head` כאבי ראש, `swelling` נפיחות, `constipation` עצירות, `cramps` התכווצויות, `sleep` קשיי שינה. Strength 1–3 (קל / בינוני / חזק).
- Measurements and their ranges:
  - `bp`: systolic 60–250 / diastolic 30–150.
  - `sugar`: mg/dL, 20–600.
  - `belly`: cm, 40–200.
  - `fhr`: bpm, 60–240.
- Notes: ≤ 500 chars each, ≤ 20 a day, optional `star`, signed with `by`/`at`.
- Anyone in the pregnancy writes and reads every part. The day log is **not** passed through `forViewer`.
- A day can be logged only from the pregnancy's day 0 (against the current EDD) through today; never in the future.
- No save buttons: every field autosaves through `useAutosave`. A day whose parts are all empty is deleted.
- `_id: '<pid>|YYYY-MM-DD'`. No extra index: reads are `_id` ranges `'<pid>|'` … `'<pid>|9'`. No week is stored.
- Weeks outside 1–40 under the current EDD get no cube and are left out of the summary.
- `src/lib/pregnancy/daylog.ts` stays import-free apart from `./dates.ts` (tests run under `node --test`).
- Hebrew, RTL, phone-first; checked at 375 px against Docker Mongo (`npm run dev:local`).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit with `MONGODB_URI=mongodb://127.0.0.1:27018/hatom-shopping-test`, because the pre-commit hook runs `next build`. Stop the dev server first: both use `.next`.

## Review Focus

1. **Two people editing one day.** A note added by the partner must not wipe her mood. PUT updates only the parts in the body (`$set`/`$unset` per part), never the whole doc. Test: `parseDayPatch` keeps absent parts absent (Task 1). Check: two writes, then both parts are kept (Task 2).
2. **Blood pressure with one field filled.** The client sends nothing for `bp`. `parseDayPatch({ m: { bp: [120] } })` fails (Task 1). The DaySheet's `bpValue('120', '')` returns `undefined` (Task 4).
3. **Clearing the last part.** Tapping the mood again sends `mood: null`. If nothing else is left, the doc is deleted and the week loses its mood bar. `isEmptyDay` is tested (Task 1). Check: the doc is gone after the clear (Task 2).
4. **A future date or a date before day 0.** It is rejected with 400 and a Hebrew message. `dayAllowed` is tested (Task 1).
5. **The EDD moved after logging.** Days that now fall outside weeks 1–40 are dropped from `weekSummary`, not put on cube 0 or 41. Tested in Task 1.

---

### Task 1: Pure day-log rules

**Files:**
- Create: `src/lib/pregnancy/daylog.ts`
- Test: `src/lib/__tests__/pregnancy-daylog.test.ts`

**Interfaces:**
- Consumes: `isDate`, `dayOfPregnancy`, `addDays`, `weekDay` from `./dates.ts`; the `Result<T>` shape `{ ok: true; value } | { ok: false; error }` (redeclare it locally, since `pregnancy.ts` imports shopping).
- Produces:
  - `type SymptomId = 'nausea' | … | 'sleep'`
  - `type MeasureId = 'bp' | 'sugar' | 'belly' | 'fhr'`
  - `SYMPTOMS: readonly { id: SymptomId; name: string }[]`
  - `MOODS: readonly string[]` (5 emojis, index = mood − 1)
  - `STRENGTH: readonly ['קל', 'בינוני', 'חזק']`
  - `MEASURES: readonly { id: MeasureId; name: string; unit: string; min: number; max: number; min2?: number; max2?: number }[]`, where `bp` has `min2`/`max2` for the diastolic value
  - `interface Measures { bp?: [number, number]; sugar?: number; belly?: number; fhr?: number }`
  - `interface DayNote { id: string; text: string; star?: true; by: string; at: string }`
  - `interface DayLog { date: string; mood?: 1|2|3|4|5; sym?: Partial<Record<SymptomId, 1|2|3>>; m?: Measures; notes?: DayNote[]; updatedAt: string }`
  - `type DayPatch = { mood?: 1|2|3|4|5 | null; sym?: Partial<Record<SymptomId, 1|2|3>> | null; m?: Measures | null }`
  - `parseDayPatch(v: unknown): Result<DayPatch>`
  - `parseNote(v: unknown): Result<{ text: string; star: boolean }>`
  - `MAX_NOTES = 20`, `MAX_NOTE_TEXT = 500`
  - `dayAllowed(edd: string, date: string, today: string): boolean`
  - `isEmptyDay(d: Omit<DayLog, 'date' | 'updatedAt'>): boolean`
  - `weekSummary(days: { date: string; mood?: number; star?: boolean }[], edd: string): Record<number, { mood: number | null; star: boolean }>`
  - `moodColor(avg: number): string`
  - `prevValues(days: { date: string; m?: Measures }[], date: string): Partial<Record<MeasureId, { value: number | [number, number]; date: string }>>`
  - `measureText(id: MeasureId, v: number | [number, number]): string`
  - `trendText(id: MeasureId, now: number | [number, number], prev: number | [number, number]): string`

- [ ] **Step 1: Write the failing tests** (EDD `2027-06-08`, so day 0 = `2026-09-01`, matching `pregnancy-schedule.test.ts`):

```ts
test('parseDayPatch keeps absent parts absent and null as a clear', () => {
  assert.deepEqual(parseDayPatch({ mood: 4 }), { ok: true, value: { mood: 4 } });
  assert.deepEqual(parseDayPatch({ mood: null }), { ok: true, value: { mood: null } });
  assert.equal(parseDayPatch({}).ok, false);                       // nothing to save
  assert.equal(parseDayPatch({ mood: 6 }).ok, false);
  assert.equal(parseDayPatch({ sym: { nausea: 4 } }).ok, false);
  assert.equal(parseDayPatch({ sym: { hiccups: 1 } }).ok, false);
  assert.deepEqual(parseDayPatch({ sym: { nausea: 2, tired: 0 } }), { ok: true, value: { sym: { nausea: 2 } } }); // 0 = off, dropped
});
test('parseDayPatch: bp only as an in-range pair', () => {
  assert.equal(parseDayPatch({ m: { bp: [120] } }).ok, false);
  assert.equal(parseDayPatch({ m: { bp: [300, 80] } }).ok, false);
  assert.deepEqual(parseDayPatch({ m: { bp: [120, 80], fhr: 150 } }), { ok: true, value: { m: { bp: [120, 80], fhr: 150 } } });
  assert.equal(parseDayPatch({ m: { sugar: 10 } }).ok, false);
});
test('parseNote trims, caps at 500, star optional', () => {
  assert.deepEqual(parseNote({ text: '  בעיטה ראשונה ', star: true }), { ok: true, value: { text: 'בעיטה ראשונה', star: true } });
  assert.equal(parseNote({ text: '' }).ok, false);
  assert.equal(parseNote({ text: 'א'.repeat(501) }).ok, false);
});
test('dayAllowed: day 0 through today only', () => {
  assert.equal(dayAllowed(EDD, '2026-09-01', '2026-11-26'), true);
  assert.equal(dayAllowed(EDD, '2026-08-31', '2026-11-26'), false);
  assert.equal(dayAllowed(EDD, '2026-11-27', '2026-11-26'), false);
});
test('isEmptyDay', () => {
  assert.equal(isEmptyDay({}), true);
  assert.equal(isEmptyDay({ sym: {}, m: {}, notes: [] }), true);
  assert.equal(isEmptyDay({ mood: 3 }), false);
});
test('weekSummary averages mood per week, flags stars, drops weeks outside 1–40', () => {
  const s = weekSummary([
    { date: '2026-11-24', mood: 2 }, { date: '2026-11-25', mood: 4, star: true }, // week 12
    { date: '2026-11-26' },                                                    // week 12, no mood
    { date: '2026-09-02', mood: 5 },                                           // week 0 → dropped
  ], EDD);
  assert.deepEqual(s, { 12: { mood: 3, star: true } });
});
test('prevValues: the last earlier value of each measure', () => {
  const p = prevValues([
    { date: '2026-11-10', m: { bp: [118, 76], sugar: 90 } },
    { date: '2026-11-20', m: { bp: [120, 80] } },
    { date: '2026-11-26', m: { bp: [125, 82] } },
  ], '2026-11-26');
  assert.deepEqual(p, { bp: { value: [120, 80], date: '2026-11-20' }, sugar: { value: 90, date: '2026-11-10' } });
});
test('measureText and trendText', () => {
  assert.equal(measureText('bp', [120, 80]), '120/80');
  assert.equal(measureText('fhr', 150), '150 פעימות לדקה');
  assert.equal(trendText('bp', [125, 80], [120, 80]), '↑5');   // by systolic
  assert.equal(trendText('belly', 90, 92), '↓2');
  assert.equal(trendText('sugar', 90, 90), 'ללא שינוי');
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run `/opt/homebrew/bin/node --test src/lib/__tests__/pregnancy-daylog.test.ts`. Expected: FAIL, because the module isn't found.
- [ ] **Step 3: Implement `daylog.ts`.**
  - Units: `מ״מ כספית` (bp), `מ״ג/ד״ל` (sugar), `ס״מ` (belly), `פעימות לדקה` (fhr).
  - `measureText` puts the unit after the number, except bp, which shows the bare `sys/dia`.
  - Measures are integers: `parseDayPatch` rounds them.
  - The `weekSummary` mood is the mean rounded to one decimal. Its week is `weekDay(dayOfPregnancy(edd, date)).w`, kept when 1 ≤ w ≤ 40.
  - `moodColor` linearly interpolates the hue from 0 (red, at 1) to 120 (green, at 5): `hsl(H 70% 50%)`.
- [ ] **Step 4: Run the tests and see them pass.** Run the same command. Expected: all pass. Then run `npm test`: all pass.
- [ ] **Step 5: Commit.** `feat(pregnancy): day log rules — symptoms, measures, parse, summary, trends`

### Task 2: Model and routes

**Files:**
- Create: `src/models/PregnancyDay.ts`
- Create: `src/app/api/pregnancy/days/route.ts`
- Create: `src/app/api/pregnancy/days/[date]/route.ts`
- Create: `src/app/api/pregnancy/days/[date]/notes/route.ts`
- Modify: `src/app/pregnancy/api.ts`, to add the client calls.

**Interfaces:**
- Consumes: Task 1's types and parsers; `requirePregnancyCaller`, `bad`, `readJson`, `serverError` from `../_shared`; `clientPromise` from `@/lib/mongodb`.
- Produces, in the model:
  - `getDayRange(pid, from, to): Promise<DayLog[]>`
  - `getSummaryRows(pid): Promise<{ date; mood?; star? }[]>`, which projects `mood` and `notes.star` and maps a doc to `star: true` when any note has one.
  - `prevMeasures(pid, date): Promise<ReturnType<typeof prevValues>>`, which reads days before `date` with `m`, newest first, limited to 60, and passes them to `prevValues`.
  - `putDay(pid, date, patch: DayPatch): Promise<DayLog | null>`: an upsert with `$set` for non-null parts, `$unset` for null ones, and `updatedAt`. It then deletes the doc and returns `null` if `isEmptyDay`.
  - `addNote(pid, date, n: DayNote): Promise<DayLog | null>`: an upsert with `$push`, guarded by `'notes.19': { $exists: false }`. It returns `null` when the day is full.
  - `updateNote(pid, date, id, { text, star }): Promise<DayLog | null>`
  - `deleteNote(pid, date, id): Promise<DayLog | null>`, which, like `putDay`, deletes an emptied doc.
- Produces, in the routes. Every answer is the day after the write as `{ day: DayLog | null }`.
  - `GET /api/pregnancy/days?summary=1` → `{ weeks }`
  - `GET /api/pregnancy/days?from&to` (≤ 21 days, else 400) → `{ days: DayLog[] }`
  - `GET /api/pregnancy/days?prev=<date>` → `{ prev }`
  - `PUT /days/<date>` with body `{ …DayPatch, today }`
  - `POST /days/<date>/notes` with `{ text, star?, today }`
  - `PATCH /days/<date>/notes` with `{ id, text, star }`
  - `DELETE /days/<date>/notes?id=`
  - Every write checks `dayAllowed(p.edd, date, today)`. `today` comes from the client, as in `reminders/done`, and must be a date within one day of `israelToday(new Date())`.
- Produces, in the client (`api.ts`): `getDaySummary()`, `getDays(from, to)`, `getPrev(date)`, `putDay(date, patch, today)`, `addNote(date, text, star, today)`, `editNote(date, id, text, star)`, `deleteNote(date, id)`.

- [ ] **Step 1: Write the model and routes** to the interfaces above. The Hebrew errors are:
  - `'אין הריון פעיל'` (404)
  - `'אפשר לרשום רק מתחילת ההריון ועד היום'`
  - `` `אפשר עד ${MAX_NOTES} הערות ביום` ``
  - `'טווח של עד 3 שבועות'`
- [ ] **Step 2: Type-check.** Run `/opt/homebrew/bin/node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false`. Expected: no output.
- [ ] **Step 3: Exercise the routes against Docker Mongo.**
  - Start `npm run dev:local -- -p 3150`, or the `workout-local` preview. Use the browser console with `fetch`.
  - `PUT /days/<today>` `{ mood: 4, today }`, then `POST notes` `{ text: 'בדיקה', today }`. The GET range shows mood 4 and one note.
  - `PUT { mood: null, today }`: the note remains (Review Focus 1).
  - `DELETE` the note: the GET range returns no doc for the day (Review Focus 3).
  - `PUT` for tomorrow returns 400 (Review Focus 4).
  - `PUT { m: { bp: [120] } }` returns 400 (Review Focus 2).
  - `GET summary=1` shows week 12 while a mood is set.
  - Clean up the test docs afterwards.
- [ ] **Step 4: Commit.** `feat(pregnancy): day log storage and routes — one doc per day, part-wise writes`

### Task 3: Day sheet and day rows

**Files:**
- Create: `src/app/pregnancy/DayLog.tsx`
- Modify: `src/app/pregnancy/pregnancy.css`

**Interfaces:**
- Consumes: Task 1 (`SYMPTOMS`, `MOODS`, `STRENGTH`, `MEASURES`, `measureText`, `trendText`) and Task 2's client calls; `Sheet`, `useAutosave` and `statusText` from calories.
- Produces:
  - `DaySheet({ p, date, today, me, onEvent, onNew, onSaved, onClose })`
    - `onEvent(e: PEvent)` and `onNew(date)` open the existing event sheet.
    - `onSaved(day: DayLog | null)` lets the parent refresh the week and the summary.
  - `DayLogRow({ day }: { day: DayLog })`: compact, for the week sheet.
  - `bpValue(sys: string, dia: string): [number, number] | null | undefined`. It returns `undefined` when only one field is filled, `null` when both are empty, and the pair otherwise. Export it for the check in Task 4.

- [ ] **Step 1: Build `DaySheet`.** The order is:
  - The title: `heDate` + `w+d`.
  - The mood: 5 buttons with `aria-pressed`. Tapping the selected one clears it.
  - The symptoms: chips that cycle off → 1 → 2 → 3 → off. The label is the name plus `STRENGTH[n-1]`.
  - The four measures: number inputs with `inputMode="numeric"`, and bp as two inputs. Under each sits a small line with `קודם {measureText} ב־{w+d} · {trendText}` from `getPrev(date)`.
  - The notes: a textarea + ⭐ toggle + "להוסיף". Each note row has ⭐, text and author, with tap to edit and delete.
  - The day's events (`p.events` on `date`) and "+ אירוע".
  - Autosave per part, with one `useAutosave` each for mood, sym and m, each sending only its own part, so they never overwrite each other. `statusText` goes at the bottom.
  - Hide the inputs and show a short line for a date before day 0 or after today. The week sheet still lists those days.
- [ ] **Step 2: Build `DayLogRow`.**
  - It shows the mood emoji, then a chip per symptom (name + 1–3 dots), then the measures joined by ` · `, then the first line of each note with ⭐ when starred.
  - It renders nothing for an empty day.
- [ ] **Step 3: Type-check and lint.** Run `tsc` as in Task 2 and `/opt/homebrew/bin/node node_modules/.bin/next lint --dir src/app/pregnancy`. Expected: clean.
- [ ] **Step 4: Commit.** `feat(pregnancy): day sheet — mood, symptoms, measures with the last value, notes; autosaved per part`

### Task 4: Wire into the week sheet, the strip and the cubes

**Files:**
- Modify: `src/app/pregnancy/Calendar.tsx`
- Modify: `src/app/pregnancy/page.tsx`
- Modify: `src/app/pregnancy/pregnancy.css`
- Modify: `CLAUDE.md` (Pregnancy section)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - A page `SheetState` member `{ kind: 'day'; date: string }`.
  - Page state `summary: Record<number, { mood: number | null; star: boolean }>`, loaded with the state and after every `onSaved`.

- [ ] **Step 1: The week sheet.**
  - It loads `getDays(days[0], days[6])` for the shown week, again on ‹ › and after `onSaved`.
  - A day head's tap now calls a new `onDay(date)` prop, which opens the DaySheet, replacing `onNew(date)`.
  - Each day renders `<DayLogRow>` under its events.
  - The aria-label becomes `` `יום ${heDate(date)}` ``.
- [ ] **Step 2: The strip.** `TodayStrip` gets a first chip, "איך היום?", which opens `{ kind: 'day', date: today }`. When today has a log, the chip reads mood emoji + `` `${n} תסמינים` `` (or the mood alone). Pass `todayLog: DayLog | null` from the page, which loads it with `getDays(today, today)`.
- [ ] **Step 3: The cubes.**
  - `WeekCubes` takes `summary`.
  - With a mood, the cube gets `<i className="pg-cube-mood" style={{ background: moodColor(mood) }} />`, a 4 px bar along the bottom edge.
  - With a star, a `⭐` sits at the top inline-start.
  - The aria-label gains `` `, מצב רוח ${MOODS[Math.round(mood) - 1]} בממוצע` `` and `', אבן דרך'`.
  - The header legend gains `· פס = מצב רוח · ⭐ = אבן דרך`.
- [ ] **Step 4: CLAUDE.md.** Add one bullet to the Pregnancy section:
  - The day log is one doc per day in `pregnancyDays`, `_id '<pid>|date'`, written part by part.
  - Everyone in the pregnancy sees it (not `forViewer`).
  - Its rules are in `daylog.ts`, and its spec is `2026-11-26-pregnancy-day-log-design.md`.
- [ ] **Step 5: Verify in the browser at 375 px against Docker Mongo.** Use the `workout-local` preview on :3150, and unregister the workout service worker if the page runs stale code.
  - "איך היום?" opens today's sheet.
  - Set mood 🙂, `nausea` בינוני, bp 120 then 80, and a ⭐ note. Close the sheet.
  - The strip chip reads `🙂 · 1 תסמינים`.
  - The week-12 cube shows a mood bar and a ⭐.
  - The week sheet's row for today shows the emoji, the chip, `120/80` and the note.
  - Typing only `120` in bp saves nothing (Review Focus 2).
  - Re-tapping 🙂 clears the mood.
  - Log bp on an earlier day, then reopen today: it shows `קודם … · ↑/↓`.
  - Delete everything again, so the local data ends as it began.
  - Screenshot the cubes and the day sheet.
- [ ] **Step 6: Commit.** Stop the dev server first. `feat(pregnancy): day log in the week sheet, "איך היום?" and mood bars on the cubes`
