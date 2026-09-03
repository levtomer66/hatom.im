// Month → week grouping for the History page.
//
// Weeks run Sunday → Saturday and are computed in the device's LOCAL time
// from the workout's `YYYY-MM-DD` date. A week that straddles two months is
// never split: it belongs to the month containing its Wednesday — the month
// that holds at least 4 of its 7 days (the Sun–Sat analogue of ISO-8601's
// "week belongs to the year of its Thursday"). Splitting would defeat the
// point of the grouping, which is an honest "how many workouts this week".
//
// Pure + import-free so it is unit-testable with `node --test`.

const DAY_MS = 86_400_000;

// `YYYY-MM-DD` → local midnight of that calendar day. `new Date('2026-09-03')`
// would be UTC midnight, which is the PREVIOUS day in negative-UTC zones.
export function parseLocalDate(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ymd);
}

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Calendar-day arithmetic via the Date constructor, so DST shifts can't
// produce a 23/25-hour "day".
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// The Sunday on or before `d` (local midnight).
export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

export function endOfWeek(weekStart: Date): Date {
  return addDays(weekStart, 6);
}

// The month a Sun–Sat week belongs to is the one containing its Wednesday.
export function weekAnchor(weekStart: Date): Date {
  return addDays(weekStart, 3);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface WeekGroup<T> {
  key: string;   // YYYY-MM-DD of the week's Sunday
  start: Date;   // Sunday, local midnight
  end: Date;     // Saturday, local midnight
  items: T[];
}

export interface MonthGroup<T> {
  key: string;   // YYYY-MM (of the weeks' anchor month)
  anchor: Date;  // first day of that month, for the label
  count: number; // total items across its weeks
  weeks: WeekGroup<T>[];
}

// Group newest-first. Items keep their incoming order inside a week (the
// history list is already newest-first).
export function groupByMonthAndWeek<T extends { date: string }>(items: T[]): MonthGroup<T>[] {
  const months = new Map<string, MonthGroup<T>>();
  for (const item of items) {
    const day = parseLocalDate(item.date);
    const weekStart = startOfWeek(day);
    const anchor = weekAnchor(weekStart);
    const mk = monthKey(anchor);

    let month = months.get(mk);
    if (!month) {
      month = {
        key: mk,
        anchor: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
        count: 0,
        weeks: [],
      };
      months.set(mk, month);
    }

    const wk = toYmd(weekStart);
    let week = month.weeks.find((w) => w.key === wk);
    if (!week) {
      week = { key: wk, start: weekStart, end: endOfWeek(weekStart), items: [] };
      month.weeks.push(week);
    }
    week.items.push(item);
    month.count += 1;
  }

  const out = [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
  for (const m of out) m.weeks.sort((a, b) => b.key.localeCompare(a.key));
  return out;
}

// How many whole weeks before the current week `weekStart` is: 0 = this
// week, 1 = last week, … Rounded so a DST hour can't skew the division.
export function weeksAgo(weekStart: Date, today: Date = new Date()): number {
  const current = startOfWeek(today);
  return Math.round((current.getTime() - weekStart.getTime()) / (7 * DAY_MS));
}
