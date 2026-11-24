// Foods to avoid in pregnancy (docs/superpowers/specs/2026-11-24-pregnancy-design.md
// § Extras): Hebrew stems on a product or food name → a one-line reason. A warning
// only, nothing is blocked. Shown to the pregnant owner only. Import-free.

const RULES: [string[], string][] = [
  [['סושי', 'סשימי', 'דג נא', 'סביצ׳ה', 'סביצה', 'טרטר דג', 'פוקה', 'גרבלקס', 'סלמון מעושן', 'לקס'], 'דג נא או מעושן קר – סיכון לליסטריה'],
  [['לא מפוסטר', 'ברי', 'קממבר', 'גורגונזולה', 'רוקפור', 'גבינה כחולה', 'גבינת עזים רכה'], 'גבינה רכה או לא מפוסטרת – סיכון לליסטריה'],
  [['טירמיסו', 'מיונז ביתי', 'ביצה רכה', 'עין רכה', 'מוס שוקולד ביתי', 'ביצה נא'], 'ביצה לא מבושלת – סיכון לסלמונלה'],
  [['כבד', 'פטה כבד', 'פאטה', 'כבד אווז'], 'כבד ומוצריו – עודף ויטמין A'],
  [['קרפצ׳יו', 'קרפצ׳ו', 'סטייק טרטר', 'בשר נא', 'נקניק לא מבושל', 'סלמי', 'פרושוטו', 'נקניקיות לא מחוממות'], 'בשר נא או מעושן קר – סיכון לטוקסופלזמה וליסטריה'],
  [['יין', 'בירה', 'וודקה', 'ויסקי', 'ערק', 'קוקטייל', 'ליקר', 'שמפניה', 'סיידר אלכוהולי', 'רום', 'טקילה', 'ג׳ין'], 'אלכוהול – להימנע לגמרי בהריון'],
  [['טונה אדומה', 'דג חרב', 'כריש', 'מקרל מלך', 'אמנון ים'], 'דג עשיר בכספית'],
];

const norm = (s: string) => ` ${s.replace(/['`׳]/g, '׳').replace(/[^\p{L}\p{N}׳ ]/gu, ' ').replace(/\s+/g, ' ').trim()} `;

/** A word-start match, so "ברי" doesn't flag "בריאות" and "רום" doesn't flag "פרומו". */
export function foodWarning(name: string): string | null {
  const n = norm(name);
  for (const [stems, why] of RULES) {
    for (const s of stems) {
      const i = n.indexOf(` ${s}`);
      if (i < 0) continue;
      const after = n[i + s.length + 1];
      // Short stems must end the word (ברי ≠ בריוש); longer ones may take a suffix.
      if (s.length <= 4 && after !== ' ' && after !== 'ת' && after !== 'ה') continue;
      return why;
    }
  }
  return null;
}
