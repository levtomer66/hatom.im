// One ingredient line → amount, unit and name: "2 כוסות קמח לבן" →
// { qty: 2, unit: 'כוס', name: 'קמח לבן' }. A line with no amount ("מלח לפי
// הטעם", "חופן פטרוזיליה") keeps its whole text as the name, qty null.
// Import-free (node --test).

import { unitKey } from './units.ts';

const UNICODE_FRAC: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

const WORDS: Record<string, number> = {
  'חצי': 0.5, 'רבע': 0.25, 'אחד': 1, 'אחת': 1,
  'שניים': 2, 'שתיים': 2, 'שני': 2, 'שתי': 2, 'שלוש': 3, 'שלושה': 3, 'שלושת': 3,
  'ארבע': 4, 'ארבעה': 4, 'חמש': 5, 'חמישה': 5, 'שש': 6, 'שישה': 6, 'שבע': 7, 'שבעה': 7,
  'שמונה': 8, 'תשע': 9, 'תשעה': 9, 'עשר': 10, 'עשרה': 10,
};

const FRAC_CHARS = Object.keys(UNICODE_FRAC).join('');
// "1 1/2", "1½", "1.5", "1/2", "½" at the start of the line.
const NUM = new RegExp(`^(\\d+(?:\\.\\d+)?)?\\s*(?:(\\d+)\\/(\\d+)|([${FRAC_CHARS}]))?`);

function leadingNumber(s: string): { qty: number; rest: string } | null {
  const m = NUM.exec(s);
  if (m && m[0].trim()) {
    const whole = m[1] ? Number(m[1]) : 0;
    let frac = 0;
    if (m[2] && m[3] && Number(m[3]) > 0) frac = Number(m[2]) / Number(m[3]);
    else if (m[4]) frac = UNICODE_FRAC[m[4]];
    // "1/2" alone: the regex reads "1" as whole and fails the fraction; handle it.
    const plain = /^(\d+)\/(\d+)/.exec(s);
    if (plain && !m[2] && Number(plain[2]) > 0) return { qty: Number(plain[1]) / Number(plain[2]), rest: s.slice(plain[0].length) };
    return { qty: whole + frac, rest: s.slice(m[0].length) };
  }
  const [first, ...more] = s.split(/\s+/);
  if (first in WORDS) return { qty: WORDS[first], rest: more.join(' ') };
  return null;
}

export function parseLine(text: string): { qty: number | null; unit: string | null; name: string } {
  const s = text.replace(/\s+/g, ' ').trim();
  const lead = leadingNumber(s);
  if (!lead) {
    // "קורט מלח": a unit with no number — no amount, but the unit is kept.
    const [first, ...more] = s.split(' ');
    if (unitKey(first) === 'קורט') return { qty: null, unit: 'קורט', name: more.join(' ') };
    return { qty: null, unit: null, name: s };
  }
  const rest = lead.rest.trim();
  const [first, ...more] = rest.split(' ');
  const unit = first ? unitKey(first) : null;
  if (unit === 'קורט') return { qty: null, unit, name: more.join(' ') };
  const name = unit ? more.join(' ') : rest;
  return { qty: lead.qty > 0 ? Math.round(lead.qty * 1000) / 1000 : null, unit, name };
}
