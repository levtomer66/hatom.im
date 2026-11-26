// Foods to avoid in pregnancy (docs/superpowers/specs/2026-11-24-pregnancy-design.md
// § Extras): Hebrew stems on a product or food name → a one-line reason. A warning
// only, nothing is blocked. Shown to the pregnant owner only. Import-free.

/** [stems, reason, unless]: a name holding an `unless` word isn't flagged ("אורז לסושי", "סושי עוף"). */
const RULES: [string[], string, string[]?][] = [
  [['סושי', 'סשימי', 'דג נא', 'סביצ׳ה', 'סביצה', 'טרטר דג', 'פוקה', 'גרבלקס', 'סלמון מעושן', 'לקס'], 'דג נא או מעושן קר – סיכון לליסטריה', ['אורז', 'להכנת', 'עוף', 'צמחוני', 'טבעוני', 'ירקות', 'אצות', 'מקלות', 'מחצלת', 'רוטב', 'חומץ', 'ג׳ינג׳ר']],
  [['לא מפוסטר', 'ברי', 'קממבר', 'גורגונזולה', 'רוקפור', 'גבינה כחולה', 'גבינת עזים רכה'], 'גבינה רכה או לא מפוסטרת – סיכון לליסטריה'],
  [['טירמיסו', 'מיונז ביתי', 'ביצה רכה', 'עין רכה', 'מוס שוקולד ביתי', 'ביצה נא'], 'ביצה לא מבושלת – סיכון לסלמונלה'],
  [['כבד', 'פטה כבד', 'פאטה', 'כבד אווז'], 'כבד ומוצריו – עודף ויטמין A', ['צמחוני', 'טבעוני']],
  [['קרפצ׳יו', 'קרפצ׳ו', 'סטייק טרטר', 'בשר נא', 'נקניק לא מבושל', 'סלמי', 'פרושוטו', 'נקניקיות לא מחוממות'], 'בשר נא או מעושן קר – סיכון לטוקסופלזמה וליסטריה'],
  [['יין', 'בירה', 'וודקה', 'ויסקי', 'ערק', 'קוקטייל', 'ליקר', 'שמפניה', 'סיידר אלכוהולי', 'רום', 'טקילה', 'ג׳ין'], 'אלכוהול – להימנע לגמרי בהריון', ['חומץ', 'נטול אלכוהול', 'ללא אלכוהול', 'בירה שחורה', 'מאלט', 'לבישול', 'ענבים']],
  [['טונה אדומה', 'דג חרב', 'חרב', 'כריש', 'מקרל מלך', 'אמנון ים'], 'דג עשיר בכספית'],
];

/** Not food at all: napkins, molds, cups… (a catalog holds plenty of "סושי" tableware). */
const NOT_FOOD = ['מגבות', 'מגבת', 'מפת', 'מפה', 'תבניות', 'תבנית', 'כוסות', 'צלחות', 'מגש', 'מגשים', 'קופסת', 'כלי'];

const norm = (s: string) => ` ${s.replace(/['`׳]/g, '׳').replace(/[^\p{L}\p{N}׳ ]/gu, ' ').replace(/\s+/g, ' ').trim()} `;

/** A word-start match, so "ברי" doesn't flag "בריאות" and "רום" doesn't flag "פרומו". */
export function foodWarning(name: string): string | null {
  const n = norm(name);
  const hasWord = (w: string) => n.includes(` ${w}`);
  if (NOT_FOOD.some(hasWord)) return null;
  for (const [stems, why, unless] of RULES) {
    if (unless?.some(hasWord)) continue;
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
