// Typed calls to /api/calories (route contracts: docs/superpowers/specs/2026-11-21-calories-design.md § API).

import { CALORIES_API_PATH } from '@/lib/calories/config';
import { isFood } from '@/lib/shopping/nutrition';
import type { Entry, MealDoc, MealItem, Meal, Settings, Totals } from '@/lib/calories/calories';
import type { DayResponse, ProductResponse, SearchResponse } from '@/lib/calories/api-types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CALORIES_API_PATH}/${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiError('אין חיבור. נסו שוב', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? 'משהו השתבש, נסו שוב', res.status);
  return data as T;
}

export const getDay = (date: string) => call<DayResponse>('GET', `day?date=${date}`);
export const addEntry = (date: string, entry: Omit<Entry, 'id' | 'at'>, per100: Totals | null, per?: Totals) =>
  call<{ entry: Entry }>('POST', 'day', { date, entry, per100, per }).then((r) => r.entry);
export const patchEntry = (date: string, id: string, patch: { meal?: Meal; qty?: number }) =>
  call<{ entry: Entry }>('PATCH', `day/${encodeURIComponent(id)}`, { date, ...patch }).then((r) => r.entry);
export const deleteEntry = (date: string, id: string) => call<{ ok: true }>('DELETE', `day/${encodeURIComponent(id)}?date=${date}`);
export const putSettings = (s: Settings) => call<{ settings: Settings }>('PUT', 'settings', s).then((r) => r.settings);
export const search = (q: string, signal?: AbortSignal) => call<SearchResponse>('GET', `search?q=${encodeURIComponent(q)}`, undefined, signal);
export const getProduct = (key: string) => call<ProductResponse>('GET', `product?key=${encodeURIComponent(key)}`);
export const putLabel = (key: string, nu: Record<string, number | null>) => call<{ per100: Totals }>('PUT', 'label', { key, nu }).then((r) => r.per100);
export const listMeals = () => call<{ meals: MealDoc[] }>('GET', 'meals').then((r) => r.meals);
export const saveMeal = (m: { name: string; portions: number; items: MealItem[] }, id?: string) =>
  call<{ meal: MealDoc }>(id ? 'PATCH' : 'POST', id ? `meals/${id}` : 'meals', m).then((r) => r.meal);
export const deleteMeal = (id: string) => call<{ ok: true }>('DELETE', `meals/${id}`);
export const toList = (key: string) => call<{ ok: true }>('POST', 'to-list', { key });

/** My items from /shopping (only for people with the shopping permission). */
export async function myItems(): Promise<{ key: string; name: string }[]> {
  const res = await fetch('/api/shopping/home');
  if (!res.ok) return [];
  const h = (await res.json()) as { items?: { key: string; name: string }[]; meta?: Record<string, { d?: string }> };
  // Food only: soap and paper towels have no calories.
  return (h.items ?? []).filter((i) => isFood(h.meta?.[i.key]?.d)).map((i) => ({ key: i.key, name: i.name }));
}
