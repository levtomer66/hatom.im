// The book's search box and tag chips. Import-free (node --test).

import type { RecipeSummary } from './types.ts';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Every word of q in the name, an ingredient or a tag; and every chosen tag. */
export function filterRecipes(list: RecipeSummary[], q: string, tags: string[]): RecipeSummary[] {
  const words = norm(q).split(' ').filter(Boolean);
  return list.filter((r) => {
    if (!tags.every((t) => r.tags.includes(t))) return false;
    if (!words.length) return true;
    const hay = norm([r.name, ...r.ingredientNames, ...r.tags].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

/** Tags in the shown recipes, the most used first, then alphabetically. */
export function tagsOf(list: RecipeSummary[]): string[] {
  const n = new Map<string, number>();
  for (const r of list) for (const t of r.tags) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)! || a.localeCompare(b, 'he'));
}
