// Client side of /api/shopping/home: the household's My items and its one
// shopping list. Used by the page and the "מה חסר?" sheet.
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import type { ListLine, MyItem } from '@/lib/shopping/home';
import type { Household } from '@/lib/shopping/household';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(SHOPPING_API_PATH + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

/** Department and photo per item key, as GET /home returns them. */
export type HomeMeta = Record<string, { d?: string; img?: string; imgBy?: 'off' | 'name' }>;
/** The caller's household (its `id` is the trips' `listId`) plus department and photo per key. */
export type HomeView = Household & { meta: HomeMeta };

export const loadHome = () => api<HomeView>('/home');

/** `home`: the household the edit was made in; the server refuses it (409) once the caller is in another. */
export const saveHome = (patch: { items?: MyItem[]; list?: ListLine[]; favStores?: number[]; homeSpot?: { lat: number; lng: number } | null; home?: string }) =>
  api<HomeView>('/home', { method: 'PATCH', body: JSON.stringify(patch) });
