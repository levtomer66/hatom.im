// Calendar — milestones (birthdays, anniversaries) and one-off events.
//
// Must stay import-free: src/lib/__tests__/calendar.test.ts imports it via a
// relative `.ts` path for `node --test`, which can't resolve `@/…`.
//
// Dates are bare `YYYY-MM-DD` calendar days with no time zone. All math runs
// on UTC midnights so DST never shifts a day; "today" is whatever local day
// the caller passes in.

export type EventKind = 'birthday' | 'anniversary' | 'event';

export interface EventKindMeta {
  id: EventKind;
  label: string;
  emoji: string;
  // Birthdays and anniversaries come back every year; an event happens once.
  recurring: boolean;
}

export const EVENT_KINDS: readonly EventKindMeta[] = [
  { id: 'birthday', label: 'יום הולדת', emoji: '🎂', recurring: true },
  { id: 'anniversary', label: 'יום שנה', emoji: '💍', recurring: true },
  { id: 'event', label: 'אירוע', emoji: '📅', recurring: false },
];

export function getEventKind(kind: EventKind): EventKindMeta {
  return EVENT_KINDS.find((k) => k.id === kind) ?? EVENT_KINDS.find((k) => k.id === 'event')!;
}

export function isEventKind(value: unknown): value is EventKind {
  return EVENT_KINDS.some((k) => k.id === value);
}

export interface CalendarEventInput {
  title: string;
  date: string; // YYYY-MM-DD
  kind: EventKind;
  emoji?: string;
  note?: string;
}

export interface CalendarEvent extends CalendarEventInput {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Seeded once, on the first read (see ensureSeeded in src/models/CalendarEvent.ts).
export const SEED_EVENTS: readonly CalendarEventInput[] = [
  { title: 'הדייט הראשון של תום ותומר', date: '2020-10-25', kind: 'anniversary', emoji: '💕' },
  { title: 'החתונה של תום ותומר', date: '2026-07-07', kind: 'anniversary', emoji: '💍' },
  { title: 'יום הולדת לתומר', date: '1994-06-16', kind: 'birthday' },
  { title: 'יום הולדת לתום', date: '1996-03-17', kind: 'birthday' },
];

export const TITLE_MAX = 80;
export const NOTE_MAX = 280;
export const EMOJI_MAX = 16; // UTF-16 units — room for one ZWJ sequence

// ---- Dates -------------------------------------------------------------

export interface Ymd {
  y: number;
  m: number; // 1–12
  d: number;
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYmd(value: string): Ymd | null {
  const match = YMD_RE.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function toYmd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function localTodayYmd(now: Date = new Date()): string {
  return toYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

function utcDay({ y, m, d }: Ymd): number {
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function daysBetween(from: string, to: string): number {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return NaN;
  return utcDay(b) - utcDay(a);
}

// The same month/day in another year. Feb 29 falls on Feb 28 in common years.
function sameDayIn(origin: Ymd, year: number): Ymd {
  return { y: year, m: origin.m, d: Math.min(origin.d, daysInMonth(year, origin.m)) };
}

// Sunday = 0 … Saturday = 6.
export function weekday(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ---- Occurrences --------------------------------------------------------

export interface Occurrence {
  event: CalendarEvent;
  date: string;
  daysUntil: number;
  // Age (birthday) or years since (anniversary); null for a one-off event.
  years: number | null;
}

export function nextOccurrence(event: CalendarEvent, todayYmd: string): Occurrence | null {
  const origin = parseYmd(event.date);
  const today = parseYmd(todayYmd);
  if (!origin || !today) return null;

  let at = origin;
  if (getEventKind(event.kind).recurring && utcDay(origin) < utcDay(today)) {
    at = sameDayIn(origin, today.y);
    if (utcDay(at) < utcDay(today)) at = sameDayIn(origin, today.y + 1);
  }
  const daysUntil = utcDay(at) - utcDay(today);
  if (daysUntil < 0) return null;

  return {
    event,
    date: toYmd(at.y, at.m, at.d),
    daysUntil,
    years: getEventKind(event.kind).recurring ? at.y - origin.y : null,
  };
}

// Every event that still has a day coming up, soonest first.
export function upcoming(events: readonly CalendarEvent[], todayYmd: string): Occurrence[] {
  return events
    .map((e) => nextOccurrence(e, todayYmd))
    .filter((o): o is Occurrence => o !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.event.title.localeCompare(b.event.title, 'he'));
}

// One-off events that already happened, most recent first.
export function pastEvents(events: readonly CalendarEvent[], todayYmd: string): CalendarEvent[] {
  return events
    .filter((e) => !getEventKind(e.kind).recurring && e.date < todayYmd)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Events falling on each day of one month, keyed by day of month. Recurring
// events show from their first year onward.
export function eventsInMonth(
  events: readonly CalendarEvent[],
  year: number,
  month: number,
): Map<number, CalendarEvent[]> {
  const byDay = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    const origin = parseYmd(event.date);
    if (!origin) continue;
    let day: number | null = null;
    if (getEventKind(event.kind).recurring) {
      if (origin.m === month && year >= origin.y) day = sameDayIn(origin, year).d;
    } else if (origin.y === year && origin.m === month) {
      day = origin.d;
    }
    if (day !== null) byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  return byDay;
}

// A Sunday-first month grid: rows of 7, `null` for padding days.
export function monthGrid(year: number, month: number): (number | null)[][] {
  const cells: (number | null)[] = Array(weekday(year, month, 1)).fill(null);
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ---- Hebrew copy --------------------------------------------------------

export function countdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'היום!';
  if (daysUntil === 1) return 'מחר';
  if (daysUntil === 2) return 'מחרתיים';
  return `עוד ${daysUntil} ימים`;
}

export function yearsHe(n: number): string {
  if (n === 1) return 'שנה';
  if (n === 2) return 'שנתיים';
  return `${n} שנים`;
}

// "גיל 33" / "6 שנים"; null when there's nothing to count yet.
export function milestoneLabel(occ: Occurrence): string | null {
  if (occ.years === null || occ.years <= 0) return null;
  return occ.event.kind === 'birthday' ? `גיל ${occ.years}` : yearsHe(occ.years);
}

// ---- Validation ---------------------------------------------------------

export type ParseResult = { ok: true; value: CalendarEventInput } | { ok: false; error: string };

export function parseEventInput(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid body' };
  const body = raw as Record<string, unknown>;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { ok: false, error: 'Title is required' };
  if (title.length > TITLE_MAX) return { ok: false, error: `Title is limited to ${TITLE_MAX} characters` };

  const date = typeof body.date === 'string' ? body.date : '';
  const ymd = parseYmd(date);
  if (!ymd || ymd.y < 1900 || ymd.y > 2200) return { ok: false, error: 'Date must be a valid YYYY-MM-DD' };

  if (!isEventKind(body.kind)) return { ok: false, error: 'Unknown kind' };

  const value: CalendarEventInput = { title, date, kind: body.kind };

  if (body.emoji !== undefined && body.emoji !== null && body.emoji !== '') {
    if (typeof body.emoji !== 'string') return { ok: false, error: 'Invalid emoji' };
    const emoji = body.emoji.trim();
    if (emoji.length > EMOJI_MAX) return { ok: false, error: 'Emoji is too long' };
    if (emoji) value.emoji = emoji;
  }

  if (body.note !== undefined && body.note !== null && body.note !== '') {
    if (typeof body.note !== 'string') return { ok: false, error: 'Invalid note' };
    const note = body.note.trim();
    if (note.length > NOTE_MAX) return { ok: false, error: `Note is limited to ${NOTE_MAX} characters` };
    if (note) value.note = note;
  }

  return { ok: true, value };
}
