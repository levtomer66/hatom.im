// The week hero's size line (docs/superpowers/specs/2026-11-24-pregnancy-design.md § The week):
// a fruit or vegetable common in Israel, with a typical length and weight. Lengths
// are crown–rump to week 19 and crown–heel from 20 (hence the jump); the values
// follow the UNSW Embryology "Fetal Development – Length – Weight" table (weeks
// 8–40; Westerway 2000 CRL for 5–7; 4–6 are the usual tracker images), rounded —
// an illustration, not a medical measure. Import-free.

export interface Size { fruit: string; emoji: string; cm: number; g: number }

const S = (fruit: string, emoji: string, cm: number, g: number): Size => ({ fruit, emoji, cm, g });

const SIZES: Record<number, Size> = {
  4: S('גרגר פרג', '🌱', 0.1, 0),
  5: S('גרגר שומשום', '🌱', 0.2, 0),
  6: S('עדשה', '🫘', 0.5, 0),
  7: S('אוכמנייה', '🫐', 1, 1),
  8: S('פטל', '🍓', 1.6, 1),
  9: S('דובדבן', '🍒', 2.3, 2),
  10: S('תות', '🍓', 3.1, 4),
  11: S('תאנה', '🟣', 4.1, 7),
  12: S('שזיף', '🟣', 5.4, 14),
  13: S('לימון', '🍋', 7.4, 23),
  14: S('נקטרינה', '🍑', 8.7, 43),
  15: S('תפוח', '🍎', 10.1, 70),
  16: S('אבוקדו', '🥑', 11.6, 100),
  17: S('רימון', '🔴', 13, 140),
  18: S('פלפל', '🫑', 14.2, 190),
  19: S('עגבנייה גדולה', '🍅', 15.3, 240),
  20: S('בננה', '🍌', 25.6, 300),
  21: S('גזר', '🥕', 26.7, 360),
  22: S('מנגו', '🥭', 27.8, 430),
  23: S('אשכולית', '🍊', 28.9, 500),
  24: S('קלח תירס', '🌽', 30, 600),
  25: S('כרובית', '🥦', 34.6, 660),
  26: S('חסה', '🥬', 35.6, 760),
  27: S('כרוב', '🥬', 36.6, 875),
  28: S('חציל', '🍆', 37.6, 1000),
  29: S('דלורית', '🎃', 38.6, 1150),
  30: S('קישוא גדול', '🥒', 39.9, 1300),
  31: S('קוקוס', '🥥', 41.1, 1500),
  32: S('שומר גדול', '🌿', 42.4, 1700),
  33: S('אננס', '🍍', 43.7, 1900),
  34: S('מלון', '🍈', 45, 2100),
  35: S('מלון דבש', '🍈', 46.2, 2400),
  36: S('חסה רומית', '🥬', 47.4, 2600),
  37: S('כרוב לבן', '🥬', 48.6, 2900),
  38: S('דלעת קטנה', '🎃', 49.8, 3100),
  39: S('אבטיח קטן', '🍉', 50.7, 3300),
  40: S('אבטיח', '🍉', 51.2, 3500),
};

/** null before week 4; past 40 it stays at 40. */
export const sizeFor = (week: number): Size | null => (week < 4 ? null : SIZES[Math.min(40, Math.floor(week))]);

/** "11.6 ס״מ · 100 ג׳" ("פחות מגרם" while it's under 1 g). */
export function sizeText(s: Size): string {
  const cm = s.cm < 1 ? `${Math.round(s.cm * 10)} מ״מ` : `${s.cm.toLocaleString('he-IL')} ס״מ`;
  const g = s.g < 1 ? 'פחות מגרם' : s.g >= 1000 ? `${(s.g / 1000).toLocaleString('he-IL', { maximumFractionDigits: 1 })} ק״ג` : `${s.g} ג׳`;
  return `${cm} · ${g}`;
}
