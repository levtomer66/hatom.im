// A pregnancy's doc and every write's checks (docs/superpowers/specs/2026-11-24-pregnancy-design.md
// § Data), the shapes the /api/pregnancy routes return, and the calorie extra.
// Import-free apart from sibling modules and shopping's invite-email rule.

import { parseInviteEmail } from '../shopping/household.ts';
import { dayOfPregnancy, eddFrom, isDate, trimester, type DatingMethod } from './dates.ts';
import { SUGGESTION_IDS, type PEvent, type Reminder, type SuggestionId } from './schedule.ts';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Dating { method: DatingMethod; date: string; w?: number; d?: number }
export interface Invite { email: string; by: string; at: string }
export interface Scan { url: string; at: string; by: string }

export interface Pregnancy {
  id: string;
  /** The pregnant one. */
  owner: string;
  /** Owner first. */
  members: string[];
  invites: Invite[];
  status: 'active' | 'ended';
  endedAt?: string;
  edd: string;
  dating: Dating;
  preKg: number | null;
  /** Asked at setup when her calories profile has no height (the profile's wins). */
  heightCm: number | null;
  cafLimit: number;
  events: PEvent[];
  reminders: Reminder[];
  dismissed: SuggestionId[];
  /** By pregnancy week. */
  scans: Record<string, Scan>;
  createdAt: string;
  updatedAt: string;
}

export const MAX_EVENTS = 100;
export const MAX_REMINDERS = 30;
export const MAX_INVITES = 10;
export const MAX_MEMBERS = 10;
export const MAX_TEXT = 80;
export const MAX_NOTE = 300;
/** Further back than this is a typo (the page would show a finished pregnancy). */
export const MAX_DAY = 300;

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s && s.length <= max ? s : null;
};
const METHODS: DatingMethod[] = ['lmp', 'transfer5', 'transfer3', 'us', 'edd'];

export const kgOk = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 30 && v <= 250;
export const heightOk = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 120 && v <= 230;

function parseDating(v: Record<string, unknown>, today: string): Result<{ dating: Dating; edd: string }> {
  const method = v.method as DatingMethod;
  if (!METHODS.includes(method)) return fail('שיטת תיארוך לא מוכרת');
  if (!isDate(v.date)) return fail('תאריך לא תקין');
  const w = method === 'us' ? v.w : undefined;
  const d = method === 'us' ? v.d : undefined;
  const edd = eddFrom(method, v.date, w as number | undefined, d as number | undefined);
  if (!edd) return fail(method === 'us' ? 'שבוע 0–42 ויום 0–6' : 'תאריך לא תקין');
  const day = dayOfPregnancy(edd, today);
  if (day < 0) return fail('התאריך יוצא בעתיד – כדאי לבדוק שוב');
  if (day > MAX_DAY) return fail('התאריך רחוק מדי – כדאי לבדוק שוב');
  const dating: Dating = { method, date: v.date, ...(method === 'us' ? { w: w as number, d: d as number } : {}) };
  return { ok: true, value: { dating, edd } };
}

export function parseSetup(v: unknown, today: string): Result<{ dating: Dating; edd: string; preKg: number | null; heightCm: number | null }> {
  if (!isObj(v)) return fail('פרטים לא תקינים');
  const dt = parseDating(v, today);
  if (!dt.ok) return dt;
  const preKg = v.preKg ?? null;
  if (preKg !== null && !kgOk(preKg)) return fail('משקל בין 30 ל־250 ק״ג');
  const heightCm = v.heightCm ?? null;
  if (heightCm !== null && !heightOk(heightCm)) return fail('גובה בין 120 ל־230 ס״מ');
  return { ok: true, value: { ...dt.value, preKg: preKg === null ? null : Math.round(preKg * 10) / 10, heightCm: heightCm === null ? null : Math.round(heightCm) } };
}

export type Patch = Partial<{ dating: Dating; edd: string; preKg: number | null; heightCm: number | null; cafLimit: number }>;

export function parsePatch(v: unknown, today: string): Result<Patch> {
  if (!isObj(v)) return fail('פרטים לא תקינים');
  const out: Patch = {};
  if (v.method !== undefined) {
    const dt = parseDating(v, today);
    if (!dt.ok) return dt;
    Object.assign(out, dt.value);
  }
  if (v.preKg !== undefined) {
    if (v.preKg !== null && !kgOk(v.preKg)) return fail('משקל בין 30 ל־250 ק״ג');
    out.preKg = v.preKg === null ? null : Math.round((v.preKg as number) * 10) / 10;
  }
  if (v.heightCm !== undefined) {
    if (v.heightCm !== null && !heightOk(v.heightCm)) return fail('גובה בין 120 ל־230 ס״מ');
    out.heightCm = v.heightCm === null ? null : Math.round(v.heightCm as number);
  }
  if (v.cafLimit !== undefined) {
    if (typeof v.cafLimit !== 'number' || !Number.isInteger(v.cafLimit) || v.cafLimit < 50 || v.cafLimit > 400) return fail('מגבלה בין 50 ל־400 מ״ג');
    out.cafLimit = v.cafLimit;
  }
  return Object.keys(out).length ? { ok: true, value: out } : fail('אין מה לשמור');
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseEvent(v: unknown): Result<Omit<PEvent, 'id'>> {
  if (!isObj(v)) return fail('אירוע לא תקין');
  const title = clean(v.title, MAX_TEXT);
  if (!title) return fail(`כותרת של עד ${MAX_TEXT} תווים`);
  if (!isDate(v.date)) return fail('תאריך לא תקין');
  if (v.time !== undefined && v.time !== null && v.time !== '' && (typeof v.time !== 'string' || !TIME.test(v.time))) return fail('שעה לא תקינה');
  const note = v.note === undefined || v.note === null || v.note === '' ? undefined : clean(v.note, MAX_NOTE);
  if (note === null) return fail(`הערה של עד ${MAX_NOTE} תווים`);
  const kind = (v.kind ?? 'custom') as PEvent['kind'];
  if (kind !== 'custom' && !SUGGESTION_IDS.has(kind)) return fail('סוג אירוע לא מוכר');
  return {
    ok: true,
    value: {
      title, date: v.date, kind, remindBefore: v.remindBefore !== false,
      ...(typeof v.time === 'string' && v.time ? { time: v.time } : {}),
      ...(note ? { note } : {}),
    },
  };
}

export function parseReminder(v: unknown): Result<Omit<Reminder, 'id' | 'done'>> {
  if (!isObj(v)) return fail('תזכורת לא תקינה');
  const text = clean(v.text, MAX_TEXT);
  if (!text) return fail(`טקסט של עד ${MAX_TEXT} תווים`);
  if (v.repeat === 'once') {
    if (!isDate(v.date)) return fail('צריך תאריך');
    return { ok: true, value: { text, repeat: 'once', date: v.date } };
  }
  if (v.repeat === 'daily') return { ok: true, value: { text, repeat: 'daily' } };
  if (v.repeat === 'weekdays') {
    const days = Array.isArray(v.days) ? [...new Set(v.days)] : [];
    if (!days.length || !days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)) return fail('צריך לבחור ימים');
    return { ok: true, value: { text, repeat: 'weekdays', days: (days as number[]).sort((a, b) => a - b) } };
  }
  return fail('חזרה לא מוכרת');
}

export function canInvite(p: Pick<Pregnancy, 'members' | 'invites'>, email: string): Result<true> {
  const e = parseInviteEmail(email);
  if (!e.ok) return e;
  if (p.members.includes(e.value)) return fail('כבר משתתף/ת');
  if (p.invites.some((i) => i.email === e.value)) return fail('כבר הוזמנ/ה');
  if (p.invites.length >= MAX_INVITES || p.members.length >= MAX_MEMBERS) return fail('אפשר עד 10');
  return { ok: true, value: true };
}

/** Extra daily kcal by trimester: 0 / +340 / +450. */
export const extraKcal = (day: number): 0 | 340 | 450 => ({ 1: 0, 2: 340, 3: 450 } as const)[trimester(day)];

// ── what the routes return ──

export interface CafRow { id: string; name: string; emoji: string; mg: number; at: string; meal: string; qty: number; unit: string }

export interface GainView {
  gain: number; lo: number; hi: number; bmi: number;
  verdict: 'in' | 'over' | 'under';
  preKg: number;
  /** Weigh-ins since the pregnancy began, with their pregnancy day. */
  log: { day: number; kg: number }[];
  band: { day: number; lo: number; hi: number }[];
}

export interface PregnancyState {
  role: 'none' | 'owner' | 'member';
  p: Pregnancy | null;
  /** Invites waiting for the caller. */
  invites: { id: string; owner: string; by: string }[];
  /** The owner's caffeine on the asked date. */
  caf: { mg: number; limit: number; rows: CafRow[] } | null;
  /** Owner only. */
  kcal: { eaten: number; goal: number } | null;
  gain: GainView | null;
  canCoffee: boolean;
  /** The owner's height is known (calories profile). */
  heightCm: number | null;
}

export interface MeResponse { gain: GainView | null; cafToday: number; limit: number; day: number }
