// Turns a workout's total volume (Σ weight × reps, in kg) into a funny,
// wholesome-absurd "you basically lifted a rhino" brag line, bilingual
// EN/HE. Pure + deterministic per workout: seed the picks off the workout
// id so re-opening the same completed workout shows the same line, and
// different workouts rotate through the catalog for variety.
//
// The brag names ONE heavy thing you out-weighed — or, when the total falls
// between two rungs of the ladder, TWO of the smaller one. Never more: "a
// rhino" / "2 hippos" lands, "740 cats" doesn't.
//
// The joke is item-based, so it's independent of the kg/lb display
// preference — item weights and volume are both kg, the ratio cancels.
//
// i18n note: this copy deliberately lives here rather than in the flat
// src/lib/workout-i18n.ts dictionary. The brag needs runtime interpolation
// ({thing}/{emoji}), singular/plural sentence forms, and deterministic
// per-workout selection — none of which useT() can express. New
// user-facing strings that DON'T need those still belong in workout-i18n.ts.

import { Language } from '@/types/workout';

// One relatable-but-absurd thing, with a real-ish mass in kg. Names carry
// singular ("one") + plural ("many") forms per language so the sentence
// reads naturally for one vs two. Kept sorted ascending by kg so selection
// can walk the ladder.
interface HeavyThing {
  kg: number;
  emoji: string;
  en: { one: string; many: string };
  he: { one: string; many: string };
}

// A comedic ladder from "aww" to "how are you alive". Weights are ballpark
// on purpose — the joke doesn't need a vet's precision.
//
// Coverage invariant: consecutive rungs must stay within ×2.5 of each other
// (MAX_RATIO below), otherwise a total in the gap has no single-or-double
// candidate and falls off the ladder. Every gap here is well under that, so
// any total up to ~2.5× the top rung (≈1,000 t) gets a count of 1 or 2.
const CATALOG: readonly HeavyThing[] = [
  { kg: 4.5,    emoji: '🐈', en: { one: 'house cat',          many: 'house cats' },          he: { one: 'חתול',              many: 'חתולים' } },
  { kg: 7,      emoji: '🎳', en: { one: 'bowling ball',       many: 'bowling balls' },       he: { one: 'כדור באולינג',      many: 'כדורי באולינג' } },
  { kg: 12,     emoji: '🐶', en: { one: 'French bulldog',     many: 'French bulldogs' },     he: { one: 'בולדוג צרפתי',      many: 'בולדוגים צרפתיים' } },
  { kg: 18,     emoji: '🐒', en: { one: 'monkey',             many: 'monkeys' },             he: { one: 'קוף',               many: 'קופים' } },
  { kg: 30,     emoji: '🐕', en: { one: 'golden retriever',   many: 'golden retrievers' },   he: { one: 'גולדן רטריבר',      many: 'גולדן רטריברים' } },
  { kg: 45,     emoji: '🪑', en: { one: 'armchair',           many: 'armchairs' },           he: { one: 'כורסה',             many: 'כורסאות' } },
  { kg: 70,     emoji: '🧺', en: { one: 'washing machine',    many: 'washing machines' },    he: { one: 'מכונת כביסה',       many: 'מכונות כביסה' } },
  { kg: 100,    emoji: '🐼', en: { one: 'giant panda',        many: 'giant pandas' },        he: { one: 'פנדה',              many: 'פנדות' } },
  { kg: 150,    emoji: '🦌', en: { one: 'reindeer',           many: 'reindeer' },            he: { one: 'איל צפוני',         many: 'איילים צפוניים' } },
  { kg: 220,    emoji: '🐗', en: { one: 'wild boar',          many: 'wild boars' },          he: { one: 'חזיר בר',           many: 'חזירי בר' } },
  { kg: 300,    emoji: '🥤', en: { one: 'vending machine',    many: 'vending machines' },    he: { one: 'מכונת ממכר',        many: 'מכונות ממכר' } },
  { kg: 400,    emoji: '🐻', en: { one: 'grizzly bear',       many: 'grizzly bears' },       he: { one: 'דוב גריזלי',        many: 'דובי גריזלי' } },
  { kg: 450,    emoji: '🎹', en: { one: 'grand piano',        many: 'grand pianos' },        he: { one: 'פסנתר כנף',         many: 'פסנתרי כנף' } },
  { kg: 550,    emoji: '🐎', en: { one: 'horse',              many: 'horses' },              he: { one: 'סוס',               many: 'סוסים' } },
  { kg: 750,    emoji: '🐄', en: { one: 'dairy cow',          many: 'dairy cows' },          he: { one: 'פרה',               many: 'פרות' } },
  { kg: 900,    emoji: '🦬', en: { one: 'bison',              many: 'bison' },               he: { one: 'ביזון',             many: 'ביזונים' } },
  { kg: 1200,   emoji: '🚗', en: { one: 'Mini Cooper',        many: 'Mini Coopers' },        he: { one: 'מיני קופר',         many: 'מכוניות מיני קופר' } },
  { kg: 1300,   emoji: '🦒', en: { one: 'giraffe',            many: 'giraffes' },            he: { one: "ג'ירפה",            many: "ג'ירפות" } },
  { kg: 1500,   emoji: '🦛', en: { one: 'hippo',              many: 'hippos' },              he: { one: 'היפופוטם',          many: 'היפופוטמים' } },
  { kg: 2000,   emoji: '🚙', en: { one: 'pickup truck',       many: 'pickup trucks' },       he: { one: 'טנדר',              many: 'טנדרים' } },
  { kg: 2300,   emoji: '🦏', en: { one: 'rhino',              many: 'rhinos' },              he: { one: 'קרנף',              many: 'קרנפים' } },
  { kg: 3500,   emoji: '🦣', en: { one: 'woolly mammoth',     many: 'woolly mammoths' },     he: { one: 'ממותה',             many: 'ממותות' } },
  { kg: 6000,   emoji: '🐘', en: { one: 'elephant',           many: 'elephants' },           he: { one: 'פיל',               many: 'פילים' } },
  { kg: 8000,   emoji: '🦖', en: { one: 'T-Rex',              many: 'T-Rexes' },             he: { one: 'טי-רקס',            many: 'טי-רקסים' } },
  { kg: 12000,  emoji: '🚌', en: { one: 'double-decker bus',  many: 'double-decker buses' }, he: { one: 'אוטובוס דו-קומתי',  many: 'אוטובוסים דו-קומתיים' } },
  { kg: 20000,  emoji: '🏚️', en: { one: 'tiny house',         many: 'tiny houses' },         he: { one: 'בית זעיר',          many: 'בתים זעירים' } },
  { kg: 30000,  emoji: '🐋', en: { one: 'humpback whale',     many: 'humpback whales' },     he: { one: 'לווייתן גדול-סנפיר', many: 'לווייתנים גדולי-סנפיר' } },
  { kg: 50000,  emoji: '🗿', en: { one: 'moai statue',        many: 'moai statues' },        he: { one: 'פסל מוֹאָי',         many: 'פסלי מוֹאָי' } },
  { kg: 90000,  emoji: '🚂', en: { one: 'steam locomotive',   many: 'steam locomotives' },   he: { one: 'קטר קיטור',         many: 'קטרי קיטור' } },
  { kg: 150000, emoji: '🐳', en: { one: 'blue whale',         many: 'blue whales' },         he: { one: 'לווייתן כחול',      many: 'לווייתנים כחולים' } },
  { kg: 200000, emoji: '🛩️', en: { one: 'passenger jet',      many: 'passenger jets' },      he: { one: 'מטוס נוסעים',       many: 'מטוסי נוסעים' } },
  { kg: 400000, emoji: '🚀', en: { one: 'space shuttle',       many: 'space shuttles' },      he: { one: 'מעבורת חלל',        many: 'מעבורות חלל' } },
];

// Wholesome-absurd sentence templates, in a singular ("one") and a plural
// ("many") form. {thing} = localized name (English singular already carries
// its a/an article), {n} = count (plural only), {emoji} = the emoji. Chosen
// deterministically per workout.
//
// Hebrew copy is written to avoid gender agreement with the noun (no
// הוא/היא, no adjectives on the thing) and to address "you" only through
// forms spelled identically for both genders (הרמת/העברת/ניצחת), so one
// template fits פרה and קרנף alike.
interface TemplateSet {
  one: readonly string[];
  many: readonly string[];
}

const TEMPLATES: Record<Language, TemplateSet> = {
  en: {
    one: [
      'That’s {thing} {emoji} you gently launched into orbit. It’s fine — just a little dizzy.',
      'You lovingly hoisted {thing} {emoji} today. Somewhere, it felt deeply supported.',
      'Equivalent to {thing} {emoji} drifting off into the sunset. Majestic. Slightly confusing.',
      'You relocated {thing} {emoji} using only your muscles and questionable decisions. Iconic.',
      'Your biceps have peacefully airlifted {thing} {emoji}. Thank you for your service.',
      'Picture {thing} {emoji} balanced on your palm like a snack. You lifted that. On purpose. Wow.',
      'Scientists confirm you moved {thing} {emoji} today. Scientists are also a little scared.',
      'Somewhere out there, {thing} {emoji} is still bragging about the day you picked it up.',
      'You vs {thing} {emoji}. Final score: you. It never stood a chance.',
      'Congratulations — you now owe {thing} {emoji} an apology and a nap.',
      'That’s {thing} {emoji} worth of “I’ll just do one more set.” Bold. Respect.',
      'You quietly out-muscled {thing} {emoji} today. The whole gym felt it.',
    ],
    many: [
      'That’s {n} {thing} {emoji} you gently launched into orbit. They’re fine — just a little dizzy.',
      'You lovingly hoisted {n} {thing} {emoji} today. Somewhere, they felt deeply supported.',
      'Equivalent to {n} {thing} {emoji} drifting off into the sunset. Majestic. Slightly confusing.',
      'You relocated {n} {thing} {emoji} using only your muscles and questionable decisions. Iconic.',
      '{n} {thing} {emoji} have been peacefully airlifted by your biceps. Thank you for your service.',
      'Picture {n} {thing} {emoji} stacked into a wobbly tower. You lifted that. On purpose. Wow.',
      'Scientists confirm you moved {n} {thing} {emoji} today. Scientists are also a little scared.',
      'Somewhere out there, {n} {thing} {emoji} are still bragging about the day you showed up.',
      'You vs {n} {thing} {emoji}. Final score: you. They never stood a chance.',
      'Congratulations — you now owe {n} {thing} {emoji} an apology and a nap.',
      'That’s {n} {thing} {emoji} worth of “I’ll just do one more set.” Bold. Respect.',
      'You quietly out-muscled {n} {thing} {emoji} today. The whole gym felt it.',
    ],
  },
  he: {
    one: [
      'זה {thing} {emoji} ששיגרת בעדינות לחלל. הכול בסדר — רק קצת סחרחורת.',
      'הרמת באהבה {thing} {emoji} היום. איפשהו, הרגישו שם תמיכה עמוקה.',
      'שווה ערך ל{thing} {emoji} בדרך אל השקיעה. מלכותי. ומעט מבלבל.',
      'העברת {thing} {emoji} ממקום למקום רק בעזרת השרירים והחלטות מפוקפקות. אייקוני.',
      'הביצפס שלך הטיס בשלום {thing} {emoji}. תודה על השירות.',
      'תארו לעצמכם {thing} {emoji} על כף היד שלך, כמו חטיף. את זה הרמת. בכוונה. וואו.',
      'מדענים אישרו שהזזת {thing} {emoji} היום. המדענים גם קצת מפוחדים.',
      'אי שם, {thing} {emoji} עדיין מספר על היום שבו הורם באוויר.',
      'קרב בינך לבין {thing} {emoji}. ניצחת בגדול.',
      'מגיעה ל{thing} {emoji} התנצלות ותנומה קטנה אחרי מה שקרה היום.',
      'זה {thing} {emoji} של "רק עוד סט אחרון". אמיץ. כל הכבוד.',
      'הרמת בשקט את המשקל הרוחני של {thing} {emoji}. כל חדר הכושר הרגיש.',
    ],
    many: [
      'זה {n} {thing} {emoji} ששיגרת בעדינות לחלל. הכול בסדר — רק קצת סחרחורת.',
      'הרמת באהבה {n} {thing} {emoji} היום. איפשהו, הרגישו שם תמיכה עמוקה.',
      'שווה ערך ל-{n} {thing} {emoji} בדרך אל השקיעה. מלכותי. ומעט מבלבל.',
      'העברת {n} {thing} {emoji} ממקום למקום רק בעזרת השרירים והחלטות מפוקפקות. אייקוני.',
      'הביצפס שלך הטיס בשלום {n} {thing} {emoji}. תודה על השירות.',
      'תארו לעצמכם {n} {thing} {emoji} מוערמים למגדל רעוע. את זה הרמת. בכוונה. וואו.',
      'מדענים אישרו שהזזת {n} {thing} {emoji} היום. המדענים גם קצת מפוחדים.',
      'אי שם, {n} {thing} {emoji} עדיין מספרים על היום שבו הורמו באוויר.',
      'קרב בינך לבין {n} {thing} {emoji}. ניצחת בגדול.',
      'מגיעה ל-{n} {thing} {emoji} התנצלות ותנומה קטנה אחרי מה שקרה היום.',
      'זה {n} {thing} {emoji} של "רק עוד סט אחרון". אמיץ. כל הכבוד.',
      'הרמת בשקט את המשקל הרוחני של {n} {thing} {emoji}. כל חדר הכושר הרגיש.',
    ],
  },
};

// Shown when the whole session was bodyweight/time-based (volume 0) —
// there's nothing to weigh, so celebrate the effort instead. Also seeded,
// so zero-volume days rotate through a few lines.
const BODYWEIGHT_LINES: Record<Language, readonly string[]> = {
  en: [
    'No weights today — just you drifting through space on pure good vibes ☁️. The clouds are so proud.',
    'Zero kilos moved, infinite style points earned. Gravity took the day off in your honor 🌬️.',
    'No iron, all willpower today 💫. The floor is genuinely impressed with you.',
    'Just you versus your own bodyweight 🪶. Spoiler: you won, gracefully.',
  ],
  he: [
    'בלי משקולות היום — רק ריחפת בחלל על טהרת הוויבים הטובים ☁️. העננים ממש גאים.',
    'אפס קילו הורמו, אינסוף נקודות סטייל נצברו. הכבידה לקחה יום חופש לכבודך 🌬️.',
    'היום בלי ברזל, רק כוח רצון 💫. הרצפה ממש מתרשמת ממך.',
    'רק גוף, בלי ברזל, היום 🪶. ניצחת בסטייל.',
  ],
};

// Tiny deterministic string hash → non-negative int. Enough to seed
// "which thing" and "which template" without pulling in a PRNG.
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A thing qualifies when the total is within a comedic margin of it:
// total/kg in [0.8, 2.5) rounds to a count of 1 or 2 — "a rhino" once you've
// lifted ≥80% of one, "2 hippos" up to just under two-and-a-half of them.
const MIN_RATIO = 0.8;
const MAX_RATIO = 2.5;

// Pick ONE heavy thing (preferred) or two — never more. Singles beat pairs;
// when several rungs qualify at the same count, the seed rotates between
// them so different workouts with similar volume don't all read the same.
function pickThing(totalKg: number, seed: number): { thing: HeavyThing; count: number } {
  const candidates = CATALOG.flatMap((thing) => {
    const ratio = totalKg / thing.kg;
    if (ratio < MIN_RATIO || ratio >= MAX_RATIO) return [];
    return [{ thing, count: Math.round(ratio) }]; // 1 or 2 by construction
  });

  if (candidates.length) {
    const minCount = Math.min(...candidates.map((c) => c.count));
    const best = candidates.filter((c) => c.count === minCount);
    return best[seed % best.length];
  }

  // Off the ladder. Above the top rung (≥ 2.5 space shuttles ≈ 1,000 t — not
  // a real workout) fall back to counting the heaviest thing; below the
  // bottom rung, a lone house cat is the smallest brag we've got.
  const heaviest = CATALOG[CATALOG.length - 1];
  if (totalKg >= heaviest.kg) {
    return { thing: heaviest, count: Math.round(totalKg / heaviest.kg) };
  }
  return { thing: CATALOG[0], count: 1 };
}

// "a rhino" / "an elephant". The catalog has no silent-h or "u-as-you"
// edge cases, so a vowel check is enough.
function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

// Public API: build the localized brag line for a completed workout.
// Always returns a line — bodyweight / zero-volume sessions get their own.
export function getVolumeBrag(totalKg: number, language: Language, seedKey: string): string {
  const seed = hashSeed(seedKey || 'workout');

  if (!Number.isFinite(totalKg) || totalKg <= 0) {
    const bw = BODYWEIGHT_LINES[language] ?? BODYWEIGHT_LINES.en;
    return bw[seed % bw.length];
  }

  const { thing, count } = pickThing(totalKg, seed);
  const lang: Language = thing[language] ? language : 'en';
  const single = count === 1;

  const name = single
    ? lang === 'en' ? withArticle(thing.en.one) : thing[lang].one
    : thing[lang].many;

  const set = TEMPLATES[lang] ?? TEMPLATES.en;
  const templates = single ? set.one : set.many;
  const template = templates[seed % templates.length];

  return template
    .replace('{n}', String(count))
    .replace('{thing}', name)
    .replace('{emoji}', thing.emoji);
}
