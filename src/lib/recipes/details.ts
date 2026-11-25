// The editor's head-and-details group (name, description, link, servings, times,
// notes, tags) as typed, and the PATCH it sends. Import-free (node --test).

import type { Recipe } from './types.ts';

export interface Details {
  name: string; description: string; sourceUrl: string; servings: string; prepMin: string; cookMin: string; notes: string; tags: string[];
}

export const detailsOf = (r: Recipe): Details => ({
  name: r.name, description: r.description ?? '', sourceUrl: r.source?.url ?? '', servings: String(r.servings),
  prepMin: r.prepMin === null ? '' : String(r.prepMin), cookMin: r.cookMin === null ? '' : String(r.cookMin), notes: r.notes, tags: r.tags,
});

const minutes = (s: string): number | null | undefined => {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 1440 ? n : undefined;
};

/** A link the server will take: empty (clears it), https, or the one already stored (an import may keep http). */
export const linkOk = (s: string, stored: string): boolean => {
  const t = s.trim();
  if (!t || t === stored) return true;
  try { return new URL(t).protocol === 'https:'; } catch { return false; }
};

/** The PATCH, or undefined while a field isn't valid (nothing is sent). The link goes only when it changed. */
export function detailsPatch(d: Details, storedUrl: string) {
  const servings = Number(d.servings);
  const prepMin = minutes(d.prepMin);
  const cookMin = minutes(d.cookMin);
  if (!d.name.trim() || !Number.isInteger(servings) || servings < 1 || servings > 100 || prepMin === undefined || cookMin === undefined) return undefined;
  if (!linkOk(d.sourceUrl, storedUrl)) return undefined;
  const url = d.sourceUrl.trim();
  return {
    name: d.name.trim(), description: d.description.trim(), servings, prepMin, cookMin, notes: d.notes, tags: d.tags,
    ...(url !== storedUrl ? { sourceUrl: url } : {}),
  };
}
