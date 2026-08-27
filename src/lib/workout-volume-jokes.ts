// Turns a workout's total volume (Σ weight × reps, in kg) into a funny,
// wholesome-absurd "you basically lifted N pandas" brag line, bilingual
// EN/HE. Pure + deterministic per workout: seed the picks off the workout
// id so re-opening the same completed workout shows the same line, and
// different workouts rotate through the catalog for variety.
//
// The joke is count-of-items, so it's independent of the kg/lb display
// preference — item weights and volume are both kg, the ratio cancels.
//
// i18n note: this copy deliberately lives here rather than in the flat
// src/lib/workout-i18n.ts dictionary. The brag needs runtime interpolation
// ({n}/{thing}/{emoji}), singular/plural noun forms, and deterministic
// per-workout selection — none of which useT() can express. New
// user-facing strings that DON'T need those still belong in workout-i18n.ts.

import { Language } from '@/types/workout';

// One relatable-but-absurd thing, with a real-ish mass in kg. Names carry
// singular ("one") + plural ("many") forms per language so the sentence
// reads naturally for a count of 1 vs many. Kept sorted ascending by kg
// so selection can walk the ladder.
interface HeavyThing {
  kg: number;
  emoji: string;
  en: { one: string; many: string };
  he: { one: string; many: string };
}

// A comedic ladder from "aww" to "how are you alive". Weights are ballpark
// on purpose — the joke doesn't need a vet's precision.
const CATALOG: readonly HeavyThing[] = [
  { kg: 4.5,   emoji: '🐈', en: { one: 'house cat',           many: 'house cats' },            he: { one: 'חתול',              many: 'חתולים' } },
  { kg: 7,     emoji: '🎳', en: { one: 'bowling ball',        many: 'bowling balls' },         he: { one: 'כדור באולינג',      many: 'כדורי באולינג' } },
  { kg: 12,    emoji: '🐶', en: { one: 'French bulldog',      many: 'French bulldogs' },       he: { one: 'בולדוג צרפתי',      many: 'בולדוגים צרפתיים' } },
  { kg: 30,    emoji: '🐕', en: { one: 'golden retriever',    many: 'golden retrievers' },     he: { one: 'גולדן רטריבר',      many: 'גולדן רטריברים' } },
  { kg: 70,    emoji: '🧺', en: { one: 'washing machine',     many: 'washing machines' },      he: { one: 'מכונת כביסה',       many: 'מכונות כביסה' } },
  { kg: 100,   emoji: '🐼', en: { one: 'giant panda',         many: 'giant pandas' },          he: { one: 'פנדה',              many: 'פנדות' } },
  { kg: 300,   emoji: '🥤', en: { one: 'vending machine',     many: 'vending machines' },      he: { one: 'מכונת ממכר',        many: 'מכונות ממכר' } },
  { kg: 400,   emoji: '🐻', en: { one: 'grizzly bear',        many: 'grizzly bears' },         he: { one: 'דוב גריזלי',        many: 'דובי גריזלי' } },
  { kg: 450,   emoji: '🎹', en: { one: 'grand piano',         many: 'grand pianos' },          he: { one: 'פסנתר כנף',         many: 'פסנתרי כנף' } },
  { kg: 550,   emoji: '🐎', en: { one: 'horse',               many: 'horses' },                he: { one: 'סוס',               many: 'סוסים' } },
  { kg: 750,   emoji: '🐄', en: { one: 'dairy cow',           many: 'dairy cows' },            he: { one: 'פרה',               many: 'פרות' } },
  { kg: 1200,  emoji: '🚗', en: { one: 'Mini Cooper',         many: 'Mini Coopers' },          he: { one: 'מיני קופר',         many: 'מכוניות מיני קופר' } },
  { kg: 1300,  emoji: '🦒', en: { one: 'giraffe',             many: 'giraffes' },              he: { one: "ג'ירפה",            many: "ג'ירפות" } },
  { kg: 1500,  emoji: '🦛', en: { one: 'hippo',               many: 'hippos' },                he: { one: 'היפופוטם',          many: 'היפופוטמים' } },
  { kg: 2300,  emoji: '🦏', en: { one: 'rhino',               many: 'rhinos' },                he: { one: 'קרנף',              many: 'קרנפים' } },
  { kg: 6000,  emoji: '🐘', en: { one: 'elephant',            many: 'elephants' },             he: { one: 'פיל',               many: 'פילים' } },
  { kg: 8000,  emoji: '🦖', en: { one: 'T-Rex',               many: 'T-Rexes' },               he: { one: 'טי-רקס',            many: 'טי-רקסים' } },
  { kg: 12000, emoji: '🚌', en: { one: 'double-decker bus',   many: 'double-decker buses' },   he: { one: 'אוטובוס דו-קומתי',  many: 'אוטובוסים דו-קומתיים' } },
  { kg: 30000, emoji: '🐋', en: { one: 'humpback whale',      many: 'humpback whales' },       he: { one: 'לווייתן',           many: 'לווייתנים' } },
];

// Wholesome-absurd sentence templates. {n} = count, {thing} = localized
// name, {emoji} = the emoji. Chosen deterministically per workout.
const TEMPLATES: Record<Language, readonly string[]> = {
  en: [
    'That’s {n} {thing} {emoji} you gently launched into orbit. They’re fine — just a little dizzy.',
    'You lovingly hoisted {n} {thing} {emoji} today. Somewhere, they felt deeply supported.',
    'Equivalent to {n} {thing} {emoji} drifting off into the sunset. Majestic. Slightly confusing.',
    'You relocated {n} {thing} {emoji} using only your muscles and questionable decisions. Iconic.',
    '{n} {thing} {emoji} have been peacefully airlifted by your biceps. Thank you for your service.',
    'Picture {n} {thing} {emoji} stacked into a wobbly tower. You lifted that. On purpose. Wow.',
  ],
  he: [
    'זה {n} {thing} {emoji} ששיגרת בעדינות לחלל. הם בסדר — רק קצת מסוחררים.',
    'הרמת באהבה {n} {thing} {emoji} היום. איפשהו, הם הרגישו מאוד נתמכים.',
    'שווה ערך ל-{n} {thing} {emoji} שמרחפים אל השקיעה. מלכותי. ומעט מבלבל.',
    'העברת {n} {thing} {emoji} רק בעזרת השרירים והחלטות מפוקפקות. אייקוני.',
    '{n} {thing} {emoji} הורמו באוויר בשלום על ידי היד שלך. תודה על השירות.',
    'תארו {n} {thing} {emoji} מוערמים למגדל רעוע. את זה הרמת. בכוונה. וואו.',
  ],
};

// Shown when the whole session was bodyweight/time-based (volume 0) —
// there's nothing to weigh, so celebrate the effort instead.
const BODYWEIGHT_LINE: Record<Language, string> = {
  en: 'No weights today — just you drifting through space on pure good vibes ☁️. The clouds are so proud.',
  he: 'בלי משקולות היום — רק ריחפת בחלל על טהרת הוויבים הטובים ☁️. העננים ממש גאים.',
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

// Pick the catalog entry whose count lands in the most satisfying range.
// Ideal is a small, punchy number (2–12: "3 hippos" hits harder than
// "1 hippo" or "740 cats"), preferring counts closest to ~4. Ties broken
// by the seed for cross-workout variety.
function pickThing(totalKg: number, seed: number): { thing: HeavyThing; count: number } {
  // Only things you actually out-weigh are eligible. Without this, an item
  // far heavier than the total (raw ≈ 0) clamps to count 1 and ties with
  // everything else — so a 5 kg session could win "1 humpback whale". If
  // the total is lighter than the whole catalog, fall back to the smallest.
  const eligible = CATALOG.filter((thing) => thing.kg <= totalKg);
  const pool0 = eligible.length ? eligible : [CATALOG[0]];

  const scored = pool0.map((thing) => ({
    thing,
    count: Math.max(1, Math.round(totalKg / thing.kg)),
  }));

  const ideal = scored.filter((s) => s.count >= 2 && s.count <= 12);
  const pool = ideal.length ? ideal : scored;

  // Prefer entries closest to a count of ~4 (the sweet spot), then use the
  // seed to rotate between equally-good candidates.
  pool.sort((a, b) => Math.abs(a.count - 4) - Math.abs(b.count - 4));
  const bestDist = Math.abs(pool[0].count - 4);
  const tied = pool.filter((s) => Math.abs(s.count - 4) === bestDist);
  const chosen = tied[seed % tied.length];
  return { thing: chosen.thing, count: chosen.count };
}

// Public API: build the localized brag line for a completed workout.
// Always returns a line — bodyweight / zero-volume sessions get their own.
export function getVolumeBrag(totalKg: number, language: Language, seedKey: string): string {
  if (!Number.isFinite(totalKg) || totalKg <= 0) {
    return BODYWEIGHT_LINE[language] ?? BODYWEIGHT_LINE.en;
  }

  const seed = hashSeed(seedKey || 'workout');
  const { thing, count } = pickThing(totalKg, seed);
  const name = count === 1 ? thing[language].one : thing[language].many;

  const templates = TEMPLATES[language] ?? TEMPLATES.en;
  const template = templates[seed % templates.length];

  return template
    .replace('{n}', String(count))
    .replace('{thing}', name)
    .replace('{emoji}', thing.emoji);
}
