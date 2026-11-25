// The WhatsApp-friendly text a recipe is shared as. No hatom.im link: the
// site is gated. Import-free (node --test).

import { scaleLine } from './scale.ts';
import type { Recipe } from './types.ts';

export function shareText(r: Recipe, servings: number): string {
  const factor = servings / Math.max(1, r.servings);
  const total = (r.prepMin ?? 0) + (r.cookMin ?? 0);
  const head = [`${servings} מנות`, total ? `⏱ ${total} דק׳` : ''].filter(Boolean).join(' · ');
  const out = [`*${r.name}*`, ...(r.description?.trim() ? [r.description.trim()] : []), head, ''];
  if (r.ingredients.length) out.push('*מצרכים:*', ...r.ingredients.map((i) => `• ${scaleLine(i, factor)}`), '');
  if (r.steps.length) out.push('*אופן הכנה:*', ...r.steps.map((s, n) => `${n + 1}. ${s}`), '');
  if (r.notes?.trim()) out.push(r.notes.trim(), '');
  if (r.source?.url) out.push(r.source.url);
  return out.join('\n').trim();
}
