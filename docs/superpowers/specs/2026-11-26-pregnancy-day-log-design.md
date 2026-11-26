# Pregnancy day log: mood, symptoms, measurements, notes

An addition to /pregnancy (`2026-11-24-pregnancy-design.md`). Agreed with the
owner on 2026-11-26: "add the option to add events stored on a day, to see
progression and history over time". All four kinds of entry, everyone in the
pregnancy logs and sees, and the history is read **in the week cubes and the
week sheet** — no separate history screen, no charts.

## What a day holds

One **day log** per pregnancy per calendar day, every part optional:

- **Mood**: 1–5, shown as 😣 😕 😐 🙂 😄.
- **Symptoms**: from a fixed list, each with a strength 1–3 (קל / בינוני / חזק):
  בחילה, הקאות, צרבת, עייפות, כאבי גב, כאבי ראש, נפיחות, עצירות, התכווצויות,
  קשיי שינה. Ids are stable (`nausea`, `vomit`, `heartburn`, `tired`, `back`,
  `head`, `swelling`, `constipation`, `cramps`, `sleep`); append new ones, never
  reorder or rename an id.
- **Measurements**: blood pressure (`bp`: systolic 60–250 / diastolic 30–150),
  sugar (`sugar`, mg/dL 20–600), belly circumference (`belly`, cm 40–200) and the
  baby's heart rate (`fhr`, bpm 60–240). Weight is not here: it stays the workout
  app's single value and the gain tile's.
- **Notes**: free text (≤ 500 chars), each signed (`by`, `at`) and optionally a
  **milestone** (⭐, e.g. "בעיטה ראשונה"). ≤ 20 notes a day.

Mood, symptoms and measurements are about her, whoever types them; the last
write wins. Anyone in the pregnancy can add, edit or delete any part, and every
member sees all of it, health values included: unlike her calories diary (and
`preKg`/`heightCm`, which `forViewer` hides), the day log is shared on purpose.
It is not passed through `forViewer`.

## Logging

- Tapping a **day row in the week sheet** opens the **day sheet** (until now a tap
  went straight to a new event). The day sheet has, top to bottom: the date and
  its `w+d`, the mood faces (tap again to clear), the symptom chips (tap cycles
  off → קל → בינוני → חזק → off), the four measurement fields, the notes (add,
  edit, delete, ⭐ toggle), the day's events and "+ אירוע" (opens the existing
  event sheet on that date).
- The **"היום" strip** gets a chip, "איך היום?", that opens today's day sheet;
  once today has a log it reads e.g. "🙂 · 2 תסמינים".
- No save buttons: every field saves through calories' `useAutosave`. A day whose
  parts are all empty is deleted, not kept as an empty doc.
- Days can be logged up to today, never in the future, and no earlier than the
  pregnancy's day 0 (checked against the current EDD when written).
- Blood pressure is saved only as a pair: while just one of the two fields holds
  a valid number the client sends nothing for `bp`; clearing both sends `null`.
  `parseDayPatch` rejects a lone value.

## History

- **Cubes**: each of the 40 cubes gets a bar along its bottom edge coloured by
  that week's average mood (red → amber → green over 1–5; no bar when no day has
  a mood) and a small ⭐ when the week has a milestone note. The cube's label
  says it in words too ("שבוע 14, מצב רוח 🙂 בממוצע, אבן דרך"), so the colour
  is never the only carrier. The event and
  suggestion dots stay as they are.
- **Week sheet**: each day row shows, under its date, the mood face, the symptom
  chips (strength as 1–3 dots), the measurement values and the first line of each
  note, so a week reads at a glance.
- **Day sheet**: each measurement field shows its last earlier value and the
  change, e.g. "קודם 120/80 ב־14+2 · ↑5", so the trend is visible without a chart.

## Data (Atlas M0)

New collection **`pregnancyDays`**, one small doc per logged day:

```ts
{
  _id: '<pregnancyId>|YYYY-MM-DD',
  pid: string,                 // pregnancy id
  date: 'YYYY-MM-DD',
  mood?: 1 | 2 | 3 | 4 | 5,
  sym?: Partial<Record<SymptomId, 1 | 2 | 3>>,
  m?: { bp?: [number, number]; sugar?: number; belly?: number; fhr?: number },
  notes?: { id: string; text: string; star?: true; by: string; at: string }[],
  updatedAt: string,
}
```

No extra index: every read is a range on `_id` (`'<pid>|'` … `'<pid>|9'`). At
most ~300 docs per pregnancy of well under 1 KB. No week is stored: the summary
groups by the week computed from `date` and the current EDD, so re-dating the
pregnancy moves the history with it. A day that lands before week 1 or after
week 40 after a re-date has no cube and is left out of the summary; it is kept
and still shows in the week sheet of its calendar week.

## API

Under `src/app/api/pregnancy/days/`, all through `requirePregnancyCaller` (any
member):

- `GET /api/pregnancy/days?summary=1` → `{ weeks: { [week]: { mood: number | null; star: boolean } } }`
  for the cubes (one `find` of the pregnancy's days, projected to
  `date`/`mood`/`notes.star`).
- `GET /api/pregnancy/days?from=YYYY-MM-DD&to=YYYY-MM-DD` (≤ 21 days) → the full
  day docs, for the open week sheet.
- `GET /api/pregnancy/days?prev=YYYY-MM-DD` → for each measurement, the last value
  before that date and its date (the day sheet's "קודם").
- `PUT /api/pregnancy/days/<date>` with `{ mood?, sym?, m? }` (null clears a part)
  and `POST|PATCH|DELETE /api/pregnancy/days/<date>/notes[/<id>]`. Every write is
  validated by a pure `parseDayPatch` / `parseNote`.

## Code layout

- `src/lib/pregnancy/daylog.ts` (import-free, `node --test`): symptom and
  measurement registries (ids, Hebrew names, ranges, units), `parseDayPatch`,
  `parseNote`, `isEmptyDay`, `weekSummary(days, edd)`, `moodColor(avg)`,
  `prevValues(days, date)`.
- `src/models/PregnancyDay.ts`: typed functions (`getDays`, `getSummary`,
  `putDay`, `addNote`, `updateNote`, `deleteNote`, `prevMeasurements`). An ended
  pregnancy keeps its days, as it keeps its doc.
- `src/app/pregnancy/DayLog.tsx`: `DaySheet` and the compact `DayLogRow` used by
  the week sheet; `Calendar.tsx` gets the cube bar/⭐ and the strip chip.
- CLAUDE.md's pregnancy section gets one bullet.

## Not in scope

Charts or a history screen, an MCP tool for the log, push reminders to log,
custom symptoms or measurements, exporting the log.
