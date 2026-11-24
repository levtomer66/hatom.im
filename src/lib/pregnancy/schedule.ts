// The calendar's rules (docs/superpowers/specs/2026-11-24-pregnancy-design.md § The calendar):
// the routine Israeli schedule as suggestions, events, in-page reminders and the
// "היום" strip. Suggestions are constants, never copied into the doc. Import-free.

import { addDays, dayOfPregnancy, daysBetween, weekdayOf } from './dates.ts';

export type SuggestionId = 'first-visit' | 'heartbeat' | 'nt' | 'early-scan' | 'triple' | 'late-scan' | 'gct' | 'anti-d' | 'tdap' | 'gbs' | 'monitor';

export interface Suggestion { id: SuggestionId; name: string; from: number; to: number; why: string }

/** Weeks inclusive (from+0 … to+6). */
export const SUGGESTIONS: readonly Suggestion[] = [
  { id: 'first-visit', name: 'פתיחת תיק הריון ובדיקות דם', from: 6, to: 10, why: 'ספירת דם, סוג דם, סרולוגיות ושתן' },
  { id: 'heartbeat', name: 'אולטרסאונד דופק', from: 6, to: 9, why: 'מיקום ההריון, דופק ותיארוך' },
  { id: 'nt', name: 'שקיפות עורפית + סקר שליש ראשון', from: 11, to: 13, why: 'סקר לתסמונת דאון ומומים' },
  { id: 'early-scan', name: 'סקירה מוקדמת', from: 14, to: 17, why: 'סקירת מערכות מוקדמת' },
  { id: 'triple', name: 'חלבון עוברי (תבחין משולש)', from: 16, to: 20, why: 'בדיקת דם לסקר' },
  { id: 'late-scan', name: 'סקירה מאוחרת', from: 19, to: 25, why: 'סקירת מערכות מלאה' },
  { id: 'gct', name: 'העמסת סוכר', from: 24, to: 28, why: 'סקר לסוכרת הריונית' },
  { id: 'anti-d', name: 'אנטי D (אם Rh שלילי)', from: 28, to: 28, why: 'רק לסוג דם Rh שלילי' },
  { id: 'tdap', name: 'חיסון שעלת', from: 27, to: 36, why: 'מגן על התינוק בחודשים הראשונים' },
  { id: 'gbs', name: 'תרבית GBS (לפי המלצה)', from: 35, to: 37, why: 'לפי המלצת הרופא/ה' },
  { id: 'monitor', name: 'מוניטור', from: 40, to: 40, why: 'מעקב אחרי תאריך הלידה' },
];

export const SUGGESTION_IDS = new Set<string>(SUGGESTIONS.map((s) => s.id));

export interface PEvent {
  id: string;
  title: string;
  date: string;
  /** HH:MM */
  time?: string;
  note?: string;
  kind: 'custom' | SuggestionId;
  remindBefore: boolean;
}

export interface Reminder {
  id: string;
  text: string;
  repeat: 'once' | 'daily' | 'weekdays';
  /** For 'once'. */
  date?: string;
  /** For 'weekdays': 0 = Sunday … 6 = Saturday. */
  days?: number[];
  /** Dates ticked done (the last 14 days only). */
  done: string[];
}

export const DONE_DAYS = 14;

export interface CalendarPart { edd: string; events: PEvent[]; reminders: Reminder[]; dismissed: SuggestionId[] }

export const openSuggestions = (events: PEvent[], dismissed: SuggestionId[]): Suggestion[] =>
  SUGGESTIONS.filter((s) => !dismissed.includes(s.id) && !events.some((e) => e.kind === s.id));

export function dueOn(r: Reminder, date: string): boolean {
  if (r.repeat === 'once') return r.date === date;
  if (r.repeat === 'daily') return true;
  return (r.days ?? []).includes(weekdayOf(date));
}

export interface StripItem { kind: 'event' | 'tomorrow' | 'reminder' | 'window'; id: string; text: string; time?: string; done?: boolean }

const byTime = (a: PEvent, b: PEvent) => (a.time ?? '99').localeCompare(b.time ?? '99');

/** Today's events (by time), today's reminders, tomorrow's events with remindBefore, open windows this week falls in. */
export function todayStrip(p: CalendarPart, today: string): StripItem[] {
  const tomorrow = addDays(today, 1);
  const week = Math.floor(dayOfPregnancy(p.edd, today) / 7);
  return [
    ...p.events.filter((e) => e.date === today).sort(byTime).map((e): StripItem => ({ kind: 'event', id: e.id, text: e.title, time: e.time })),
    ...p.reminders.filter((r) => dueOn(r, today)).map((r): StripItem => ({ kind: 'reminder', id: r.id, text: r.text, done: r.done.includes(today) })),
    ...p.events.filter((e) => e.date === tomorrow && e.remindBefore).sort(byTime).map((e): StripItem => ({ kind: 'tomorrow', id: e.id, text: e.title, time: e.time })),
    ...openSuggestions(p.events, p.dismissed).filter((s) => s.from <= week && s.to >= week).map((s): StripItem => ({ kind: 'window', id: s.id, text: s.name })),
  ];
}

/** Tick (or untick) a reminder for `date`; only dates in the 14 days up to today are kept (a future one never). */
export function markDone(r: Reminder, date: string, done: boolean, today: string): Reminder {
  const inWindow = (d: string) => { const n = daysBetween(d, today); return n >= 0 && n < DONE_DAYS; };
  const kept = r.done.filter((d) => d !== date && inWindow(d));
  return { ...r, done: (done && inWindow(date) ? [...kept, date] : kept).sort() };
}

/** For a cube's dots: events in that pregnancy week, open suggestions whose window covers it. */
export function weekMarks(p: CalendarPart, week: number): { events: number; windows: number } {
  const events = p.events.filter((e) => Math.floor(dayOfPregnancy(p.edd, e.date) / 7) === week).length;
  const windows = openSuggestions(p.events, p.dismissed).filter((s) => s.from <= week && s.to >= week).length;
  return { events, windows };
}
