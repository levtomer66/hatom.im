// Month → week grouping for the History page.
//
// Months are calendar months of the workout's own date (the grouping the
// owner asked to keep). Inside each month, weeks run Sunday → Saturday and
// are computed in the device's LOCAL time from the `YYYY-MM-DD` date. A week
// that straddles two months appears in BOTH months, each showing only the
// days that fall inside it — the visible range is clipped to the month
// ("Aug 30 – 31" under August, "Sep 1 – 5" under September) so a partial
// week is self-explanatory. (The alternative — assigning the whole week to
// one month so its count is never split — was considered and rejected
// because it moves workouts out of their calendar month.)
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

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface WeekGroup<T> {
  key: string;        // YYYY-MM-DD of the week's Sunday
  start: Date;        // the week's Sunday — may fall in the previous month
  end: Date;          // the week's Saturday — may fall in the next month
  rangeStart: Date;   // `start` clipped to this month (what the label shows)
  rangeEnd: Date;     // `end` clipped to this month
  partial: boolean;   // true when the week continues in an adjacent month
  items: T[];
}

export interface MonthGroup<T> {
  key: string;        // YYYY-MM
  monthStart: Date;   // first day of the month, for the label
  count: number;      // total items across its weeks
  weeks: WeekGroup<T>[];
}

// Group newest-first. Items keep their incoming order inside a week (the
// history list is already newest-first).
export function groupByMonthAndWeek<T extends { date: string }>(items: T[]): MonthGroup<T>[] {
  const months = new Map<string, MonthGroup<T>>();
  for (const item of items) {
    const day = parseLocalDate(item.date);
    const mk = monthKey(day);

    let month = months.get(mk);
    if (!month) {
      month = { key: mk, monthStart: startOfMonth(day), count: 0, weeks: [] };
      months.set(mk, month);
    }

    const weekStart = startOfWeek(day);
    const wk = toYmd(weekStart);
    let week = month.weeks.find((w) => w.key === wk);
    if (!week) {
      const weekEnd = endOfWeek(weekStart);
      const monthEnd = endOfMonth(day);
      const rangeStart = weekStart < month.monthStart ? month.monthStart : weekStart;
      const rangeEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
      week = {
        key: wk,
        start: weekStart,
        end: weekEnd,
        rangeStart,
        rangeEnd,
        partial: rangeStart.getTime() !== weekStart.getTime() || rangeEnd.getTime() !== weekEnd.getTime(),
        items: [],
      };
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
