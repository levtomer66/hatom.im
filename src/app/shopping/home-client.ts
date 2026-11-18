// Client side of /api/shopping/home: the household's My items and its one
// shopping list. Used by the page and the "מה חסר?" sheet.
import { SHOPPING_API_PATH } from '@/lib/shopping/config';
import type { ListLine, MyItem, ShoppingHome } from '@/lib/shopping/home';

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
export type HomeView = ShoppingHome & { meta: HomeMeta };

export const loadHome = () => api<HomeView>('/home');

export const saveHome = (patch: { items?: MyItem[]; list?: ListLine[]; favStores?: number[] }) =>
  api<HomeView>('/home', { method: 'PATCH', body: JSON.stringify(patch) });

/** "הוסף לרשימה": picked My items onto the list (items already there keep their quantity). */
export const submitMissing = (add: { key: string; qty: number }[]) =>
  api<HomeView>('/home/list', { method: 'POST', body: JSON.stringify({ add }) });
