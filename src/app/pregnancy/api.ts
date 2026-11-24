// Typed calls to /api/pregnancy (contracts: docs/superpowers/specs/2026-11-24-pregnancy-design.md).

import type { Meal } from '@/lib/calories/calories';
import type { Pregnancy, PregnancyState } from '@/lib/pregnancy/pregnancy';
import type { PEvent, Reminder, SuggestionId } from '@/lib/pregnancy/schedule';
import { ApiError } from '../calories/api';

export { ApiError };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/pregnancy${path}`, {
      method,
      headers: body === undefined || body instanceof FormData ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('אין חיבור. נסו שוב', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? 'משהו השתבש, נסו שוב', res.status);
  return data as T;
}

type P = { p: Pregnancy };

export const getState = (date: string, today: string) => call<PregnancyState>('GET', `?date=${date}&today=${today}`);
export const setup = (b: Record<string, unknown>) => call<P>('POST', '', b);
export const patch = (b: Record<string, unknown>) => call<P>('PATCH', '', b);
export const end = () => call<{ ok: true }>('DELETE', '');

export const addEvent = (e: Omit<PEvent, 'id'>) => call<P>('POST', '/events', e);
export const updateEvent = (e: PEvent) => call<P>('PATCH', '/events', e);
export const deleteEvent = (id: string) => call<P>('DELETE', `/events?id=${encodeURIComponent(id)}`);
export const dismiss = (sid: SuggestionId, on: boolean) => call<P>('POST', '/dismiss', { sid, on });

export const addReminder = (r: Omit<Reminder, 'id' | 'done'>) => call<P>('POST', '/reminders', r);
export const updateReminder = (r: Omit<Reminder, 'done'>) => call<P>('PATCH', '/reminders', r);
export const deleteReminder = (id: string) => call<P>('DELETE', `/reminders?id=${encodeURIComponent(id)}`);
export const tick = (id: string, date: string, done: boolean, today: string) => call<P>('POST', '/reminders/done', { id, date, done, today });

export const invite = (email: string) => call<P & { noAccess: boolean }>('POST', '/invites', { email });
export const removePerson = (email: string) => call<P>('DELETE', `/invites?email=${encodeURIComponent(email)}`);
export const answerInvite = (id: string, accept: boolean) => call<{ ok: true }>('POST', '/invites/accept', { id, accept });

export function uploadScan(week: number, file: File) {
  const f = new FormData();
  f.set('week', String(week));
  f.set('file', file);
  return call<P>('POST', '/scans', f);
}
export const deleteScan = (week: number) => call<P>('DELETE', `/scans?week=${week}`);

export const logDrink = (id: string, date: string, meal?: Meal) => call<{ entry: { id: string } }>('POST', '/drink', { id, date, meal, hour: new Date().getHours() });
