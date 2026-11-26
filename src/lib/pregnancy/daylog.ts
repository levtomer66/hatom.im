// The day log (docs/superpowers/specs/2026-11-26-pregnancy-day-log-design.md): mood,
// symptoms, measurements and notes on a day, shared by everyone in the pregnancy.
// Registries, every write's checks, and the history the cubes and the day sheet
// show. Import-free apart from ./dates.ts, for `node --test`.

import { dayOfPregnancy, isDate, weekDay } from './dates.ts';

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Stable ids: append new ones, never reorder or rename. */
export const SYMPTOMS = [
  { id: 'nausea', name: 'בחילה' },
  { id: 'vomit', name: 'הקאות' },
  { id: 'heartburn', name: 'צרבת' },
  { id: 'tired', name: 'עייפות' },
  { id: 'back', name: 'כאבי גב' },
  { id: 'head', name: 'כאבי ראש' },
  { id: 'swelling', name: 'נפיחות' },
  { id: 'constipation', name: 'עצירות' },
  { id: 'cramps', name: 'התכווצויות' },
  { id: 'sleep', name: 'קשיי שינה' },
] as const;
export type SymptomId = (typeof SYMPTOMS)[number]['id'];
const SYMPTOM_IDS = new Set<string>(SYMPTOMS.map((s) => s.id));

/** Mood 1–5 is MOODS[mood − 1]. */
export const MOODS = ['😣', '😕', '😐', '🙂', '😄'] as const;
export const STRENGTH = ['קל', 'בינוני', 'חזק'] as const;

export type MeasureId = 'bp' | 'sugar' | 'belly' | 'fhr';
export interface Measure { id: MeasureId; name: string; unit: string; min: number; max: number; min2?: number; max2?: number }
export const MEASURES: readonly Measure[] = [
  { id: 'bp', name: 'לחץ דם', unit: 'מ״מ כספית', min: 60, max: 250, min2: 30, max2: 150 },
  { id: 'sugar', name: 'סוכר', unit: 'מ״ג/ד״ל', min: 20, max: 600 },
  { id: 'belly', name: 'היקף בטן', unit: 'ס״מ', min: 40, max: 200 },
  { id: 'fhr', name: 'דופק העובר', unit: 'פעימות לדקה', min: 60, max: 240 },
];

export interface Measures { bp?: [number, number]; sugar?: number; belly?: number; fhr?: number }
export type Mood = 1 | 2 | 3 | 4 | 5;
export type Strength = 1 | 2 | 3;
export interface DayNote { id: string; text: string; star?: true; by: string; at: string }
export interface DayLog {
  date: string;
  mood?: Mood;
  sym?: Partial<Record<SymptomId, Strength>>;
  m?: Measures;
  notes?: DayNote[];
  updatedAt: string;
}
/** A part that's absent stays as it is; null clears it. */
export interface DayPatch { mood?: Mood | null; sym?: Partial<Record<SymptomId, Strength>> | null; m?: Measures | null }

export const MAX_NOTES = 20;
export const MAX_NOTE_TEXT = 500;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const inRange = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function parseMeasures(v: unknown): Result<Measures> {
  if (!isObj(v)) return fail('מדידות לא תקינות');
  const out: Measures = {};
  for (const [k, val] of Object.entries(v)) {
    const def = MEASURES.find((x) => x.id === k);
    if (!def) return fail('מדידה לא מוכרת');
    if (val === undefined || val === null) continue;
    if (def.id === 'bp') {
      if (!Array.isArray(val) || val.length !== 2 || !inRange(val[0], def.min, def.max) || !inRange(val[1], def.min2!, def.max2!)) {
        return fail(`לחץ דם: עליון ${def.min}–${def.max}, תחתון ${def.min2}–${def.max2}`);
      }
      out.bp = [Math.round(val[0]), Math.round(val[1])];
    } else {
      if (!inRange(val, def.min, def.max)) return fail(`${def.name}: ${def.min}–${def.max} ${def.unit}`);
      out[def.id] = Math.round(val);
    }
  }
  return { ok: true, value: out };
}

export function parseDayPatch(v: unknown): Result<DayPatch> {
  if (!isObj(v)) return fail('בקשה לא תקינה');
  const out: DayPatch = {};
  if ('mood' in v && v.mood !== undefined) {
    if (v.mood !== null && !(Number.isInteger(v.mood) && inRange(v.mood, 1, 5))) return fail('מצב רוח 1–5');
    out.mood = v.mood as Mood | null;
  }
  if ('sym' in v && v.sym !== undefined) {
    if (v.sym === null) out.sym = null;
    else {
      if (!isObj(v.sym)) return fail('תסמינים לא תקינים');
      const sym: Partial<Record<SymptomId, Strength>> = {};
      for (const [k, s] of Object.entries(v.sym)) {
        if (!SYMPTOM_IDS.has(k)) return fail('תסמין לא מוכר');
        if (s === 0 || s === null) continue;
        if (!(Number.isInteger(s) && inRange(s, 1, 3))) return fail('עוצמה 1–3');
        sym[k as SymptomId] = s as Strength;
      }
      out.sym = sym;
    }
  }
  if ('m' in v && v.m !== undefined) {
    if (v.m === null) out.m = null;
    else {
      const m = parseMeasures(v.m);
      if (!m.ok) return m;
      out.m = m.value;
    }
  }
  return Object.keys(out).length ? { ok: true, value: out } : fail('אין מה לשמור');
}

export function parseNote(v: unknown): Result<{ text: string; star: boolean }> {
  if (!isObj(v) || typeof v.text !== 'string') return fail('הערה לא תקינה');
  const text = v.text.trim();
  if (!text || text.length > MAX_NOTE_TEXT) return fail(`הערה של עד ${MAX_NOTE_TEXT} תווים`);
  return { ok: true, value: { text, star: v.star === true } };
}

/** From the pregnancy's day 0 (under the current EDD) through today. */
export const dayAllowed = (edd: string, date: string, today: string): boolean =>
  isDate(date) && date <= today && dayOfPregnancy(edd, date) >= 0;

export function isEmptyDay(d: Partial<Omit<DayLog, 'date' | 'updatedAt'>>): boolean {
  return !d.mood && !Object.keys(d.sym ?? {}).length && !Object.keys(d.m ?? {}).length && !(d.notes ?? []).length;
}

export interface WeekMark { mood: number | null; star: boolean }

/** Per pregnancy week 1–40 (under the current EDD): mean mood (one decimal) and whether a note is starred. */
export function weekSummary(days: { date: string; mood?: number; star?: boolean }[], edd: string): Record<number, WeekMark> {
  const acc: Record<number, { sum: number; n: number; star: boolean }> = {};
  for (const d of days) {
    const w = weekDay(dayOfPregnancy(edd, d.date)).w;
    if (w < 1 || w > 40) continue;
    const a = (acc[w] ??= { sum: 0, n: 0, star: false });
    if (d.mood) { a.sum += d.mood; a.n += 1; }
    if (d.star) a.star = true;
  }
  const out: Record<number, WeekMark> = {};
  for (const [w, a] of Object.entries(acc)) {
    if (!a.n && !a.star) continue;
    out[Number(w)] = { mood: a.n ? Math.round((a.sum / a.n) * 10) / 10 : null, star: a.star };
  }
  return out;
}

/** Red (1) to green (5). */
export const moodColor = (avg: number): string => `hsl(${Math.round(((Math.min(5, Math.max(1, avg)) - 1) / 4) * 120)} 70% 50%)`;

export type MeasureValue = number | [number, number];
export type PrevValues = Partial<Record<MeasureId, { value: MeasureValue; date: string }>>;

/** Each measure's last value on a day before `date`. */
export function prevValues(days: { date: string; m?: Measures }[], date: string): PrevValues {
  const out: PrevValues = {};
  for (const d of [...days].filter((x) => x.date < date).sort((a, b) => b.date.localeCompare(a.date))) {
    for (const def of MEASURES) {
      const v = d.m?.[def.id];
      if (v !== undefined && !out[def.id]) out[def.id] = { value: v, date: d.date };
    }
  }
  return out;
}

export const measureText = (id: MeasureId, v: MeasureValue): string =>
  Array.isArray(v) ? `${v[0]}/${v[1]}` : `${v} ${MEASURES.find((x) => x.id === id)!.unit}`;

/** "↑5", "↓2", "ללא שינוי" (blood pressure by its systolic value). */
export function trendText(_id: MeasureId, now: MeasureValue, prev: MeasureValue): string {
  const a = Array.isArray(now) ? now[0] : now;
  const b = Array.isArray(prev) ? prev[0] : prev;
  return a === b ? 'ללא שינוי' : a > b ? `↑${a - b}` : `↓${b - a}`;
}
