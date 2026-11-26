// An ingredient line for N servings: "1 כוס קמח" × 1.5 → "1½ כוסות קמח".
// Import-free (node --test).

import { UNITS } from './units.ts';
import type { Ingredient } from './types.ts';

const GLYPH: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** Cups and spoons: to the nearest ¼, written "1½". */
function quarters(v: number): string {
  const q = Math.max(0.25, Math.round(v * 4) / 4);
  const whole = Math.floor(q);
  const frac = q - whole;
  if (!frac) return String(whole);
  return `${whole || ''}${GLYPH[frac]}`;
}

const trim = (v: number) => String(Math.round(v * 100) / 100);

/** The amount as written, and the number it stands for (to pick singular/plural). */
function amount(qty: number, unit: string | null): { shown: string; value: number } {
  if (unit === 'כוס' || unit === 'כף' || unit === 'כפית') {
    const q = Math.max(0.25, Math.round(qty * 4) / 4);
    return { shown: quarters(qty), value: q };
  }
  if (unit === 'גרם' || unit === 'מ״ל') {
    const v = qty > 50 ? Math.round(qty / 5) * 5 : Math.max(1, Math.round(qty));
    return { shown: String(v), value: v };
  }
  if (unit === 'ק״ג' || unit === 'ליטר') return { shown: trim(qty), value: qty };
  const v = Math.max(1, Math.round(qty));
  return { shown: String(v), value: v };
}

export function scaleLine(ing: Ingredient, factor: number): string {
  if (ing.qty === null) return ing.text || ing.name;
  if (factor === 1 && ing.text) return ing.text;
  const { shown, value } = amount(ing.qty * factor, ing.unit);
  const def = ing.unit ? UNITS[ing.unit] : undefined;
  const unit = def ? (value > 1 ? def.plural : ing.unit) : '';
  return [shown, unit, ing.name].filter(Boolean).join(' ');
}
