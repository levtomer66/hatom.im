// Pregnancy date math (docs/superpowers/specs/2026-11-24-pregnancy-design.md § The week).
// Everything is a bare YYYY-MM-DD on UTC midnights; one stored due date (EDD)
// drives the rest. Day 0 = the LMP, day 280 = the EDD. Import-free for `node --test`.

export type DatingMethod = 'lmp' | 'transfer5' | 'transfer3' | 'us' | 'edd';

export const PREGNANCY_DAYS = 280;

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);

export function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fmt(parse(s)) === s;
}

export const addDays = (date: string, n: number): string => fmt(parse(date) + n * 86_400_000);
export const daysBetween = (a: string, b: string): number => Math.round((parse(b) - parse(a)) / 86_400_000);

/**
 * The due date from what was typed: LMP + 280; a day-5 transfer + 261, day-3 + 263;
 * an ultrasound "w+d on date" + (280 − days); or the EDD itself. null when invalid.
 */
export function eddFrom(method: DatingMethod, date: string, w?: number, d?: number): string | null {
  if (!isDate(date)) return null;
  switch (method) {
    case 'lmp': return addDays(date, PREGNANCY_DAYS);
    case 'transfer5': return addDays(date, 261);
    case 'transfer3': return addDays(date, 263);
    case 'edd': return date;
    case 'us': {
      if (!Number.isInteger(w) || !Number.isInteger(d) || (w as number) < 0 || (w as number) > 42 || (d as number) < 0 || (d as number) > 6) return null;
      return addDays(date, PREGNANCY_DAYS - (7 * (w as number) + (d as number)));
    }
  }
}

/** Days since the LMP on `today` (may be negative, or past 294 when the dates are wrong). */
export const dayOfPregnancy = (edd: string, today: string): number => PREGNANCY_DAYS - daysBetween(today, edd);

export const weekDay = (day: number) => ({ w: Math.floor(day / 7), d: ((day % 7) + 7) % 7 });

/** "12 שבועות ו־3 ימים", "שבועיים ויום", "3 ימים". */
export function wdText(day: number): string {
  const { w, d } = weekDay(day);
  const weeks = w === 0 ? '' : w === 1 ? 'שבוע אחד' : w === 2 ? 'שבועיים' : `${w} שבועות`;
  if (!d) return weeks || '0 ימים';
  if (!weeks) return d === 1 ? 'יום אחד' : d === 2 ? 'יומיים' : `${d} ימים`;
  return `${weeks} ${d === 1 ? 'ויום' : d === 2 ? 'ויומיים' : `ו־${d} ימים`}`;
}

/** 1st up to 13+6, 2nd up to 27+6, then 3rd. */
export const trimester = (day: number): 1 | 2 | 3 => (day < 98 ? 1 : day < 196 ? 2 : 3);

export const TRIMESTER_NAMES = { 1: 'שליש ראשון', 2: 'שליש שני', 3: 'שליש שלישי' } as const;

/** The calendar date of pregnancy day `day`. */
export const dateOfDay = (edd: string, day: number): string => addDays(edd, day - PREGNANCY_DAYS);

/** The Israeli week (Sunday to Saturday) that holds `date`. */
export function calendarWeek(date: string): string[] {
  const sunday = addDays(date, -new Date(parse(date)).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

export const weekdayOf = (date: string): number => new Date(parse(date)).getUTCDay();

/** Israeli d.m.yyyy. */
export function heDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d}.${m}.${y}`;
}

const IL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });

const ilParts = (now: Date) => Object.fromEntries(IL.formatToParts(now).map((p) => [p.type, p.value]));

/** The day in Israel at `now` (server paths: coffee orders, MCP). */
export function israelToday(now: Date): string {
  const p = ilParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

export const israelHour = (now: Date): number => Number(ilParts(now).hour) % 24;
