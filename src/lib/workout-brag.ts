// The "you basically lifted a rhino" line on the completion summary and the
// feed, bilingual EN/HE.
//
// Why it looks like this: the first version picked one object off a weight
// ladder (by total volume) and one of 12 sentences by hashing the workout id.
// A person's workouts weigh about the same every time, so it was the same
// T-Rex or the same bus every week, with a sentence collision every few
// workouts. This version fixes both:
//
//  1. Several joke FAMILIES, each built from a different fact about the
//     session (total volume, your heaviest exercise, vs. your last workout,
//     reps, duration, time of day, bodyweight-only days).
//  2. A big object catalog with several objects per weight band, counts of
//     1–3, and true randomness.
//  3. MEMORY: the pick is made once, on the server, when the workout is
//     completed, avoiding the families/sentences/objects of the user's recent
//     workouts, and stored on the workout (`Workout.brag`) and copied to its
//     feed post. Rendering a stored pick is pure, so changing the language
//     re-renders the same joke.
//
// Workouts completed before this shipped have no stored pick; they get a
// seeded pick from their id and volume (`fallbackBrag`), stable per workout.
//
// Import-free on purpose so `node --test` can load it
// (src/lib/__tests__/workout-brag.test.ts).
//
// Hebrew copy avoids gender agreement with the noun and with "you": no
// הוא/היא, no adjectives on the object, and verbs only in forms spelled the
// same for both genders (הרמת, העברת, ניצחת, סיימת).

export type BragLanguage = 'en' | 'he';

export type BragFamily = 'thing' | 'top' | 'vs-last' | 'reps' | 'time' | 'hour' | 'bodyweight';

// What the server knows about a just-completed workout.
export interface BragFacts {
  totalVolumeKg: number;
  setsLogged: number;
  reps: number;
  // Minutes from start to completion; null when unknown or implausible.
  minutes: number | null;
  // The exercise that moved the most volume today.
  top: { id: string; name: string; volumeKg: number; reps: number } | null;
  // Volume of the user's previous completed workout; null if none.
  prevVolumeKg: number | null;
  // The user's local hour (0–23) at completion, sent by the client.
  localHour: number | null;
}

// A stored joke: enough to re-render it in either language, nothing more.
// `x` holds the numbers/names the sentence needs.
export interface BragPick {
  v: 1;
  f: BragFamily;
  t: number;            // sentence index within the family + form
  thing?: string;       // catalog id
  n?: number;           // how many of the thing (1–3)
  x?: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

interface HeavyThing {
  id: string;
  kg: number;
  emoji: string;
  en: { one: string; many: string };
  he: { one: string; many: string };
}

// Ballpark masses on purpose; the joke doesn't need a vet's precision.
// Sorted ascending. Coverage invariant (tested): consecutive objects stay
// within ×2.5, so every total has at least one 1-or-2 candidate.
const CATALOG: readonly HeavyThing[] = [
  { id: 'cat',            kg: 4.5,    emoji: '🐈', en: { one: 'house cat', many: 'house cats' }, he: { one: 'חתול', many: 'חתולים' } },
  { id: 'watermelon',     kg: 6,      emoji: '🍉', en: { one: 'watermelon', many: 'watermelons' }, he: { one: 'אבטיח', many: 'אבטיחים' } },
  { id: 'bowling-ball',   kg: 7,      emoji: '🎳', en: { one: 'bowling ball', many: 'bowling balls' }, he: { one: 'כדור באולינג', many: 'כדורי באולינג' } },
  { id: 'turkey',         kg: 9,      emoji: '🦃', en: { one: 'Thanksgiving turkey', many: 'Thanksgiving turkeys' }, he: { one: 'תרנגול הודו', many: 'תרנגולי הודו' } },
  { id: 'bulldog',        kg: 12,     emoji: '🐶', en: { one: 'French bulldog', many: 'French bulldogs' }, he: { one: 'בולדוג צרפתי', many: 'בולדוגים צרפתיים' } },
  { id: 'microwave',      kg: 15,     emoji: '📦', en: { one: 'microwave', many: 'microwaves' }, he: { one: 'מיקרוגל', many: 'מיקרוגלים' } },
  { id: 'monkey',         kg: 18,     emoji: '🐒', en: { one: 'monkey', many: 'monkeys' }, he: { one: 'קוף', many: 'קופים' } },
  { id: 'suitcase',       kg: 23,     emoji: '🧳', en: { one: 'maxed-out suitcase', many: 'maxed-out suitcases' }, he: { one: 'מזוודה עמוסה', many: 'מזוודות עמוסות' } },
  { id: 'retriever',      kg: 30,     emoji: '🐕', en: { one: 'golden retriever', many: 'golden retrievers' }, he: { one: 'גולדן רטריבר', many: 'גולדן רטריברים' } },
  { id: 'kangaroo',       kg: 40,     emoji: '🦘', en: { one: 'kangaroo', many: 'kangaroos' }, he: { one: 'קנגורו', many: 'קנגורואים' } },
  { id: 'armchair',       kg: 45,     emoji: '🪑', en: { one: 'armchair', many: 'armchairs' }, he: { one: 'כורסה', many: 'כורסאות' } },
  { id: 'gas-cylinder',   kg: 50,     emoji: '🔥', en: { one: 'full gas balloon', many: 'full gas balloons' }, he: { one: 'בלון גז מלא', many: 'בלוני גז מלאים' } },
  { id: 'dishwasher',     kg: 60,     emoji: '🍽️', en: { one: 'dishwasher', many: 'dishwashers' }, he: { one: 'מדיח כלים', many: 'מדיחי כלים' } },
  { id: 'washer',         kg: 70,     emoji: '🧺', en: { one: 'washing machine', many: 'washing machines' }, he: { one: 'מכונת כביסה', many: 'מכונות כביסה' } },
  { id: 'fridge',         kg: 85,     emoji: '🧊', en: { one: 'family fridge', many: 'family fridges' }, he: { one: 'מקרר משפחתי', many: 'מקררים משפחתיים' } },
  { id: 'panda',          kg: 100,    emoji: '🐼', en: { one: 'giant panda', many: 'giant pandas' }, he: { one: 'פנדה', many: 'פנדות' } },
  { id: 'ostrich',        kg: 120,    emoji: '🦤', en: { one: 'ostrich', many: 'ostriches' }, he: { one: 'יען', many: 'יענים' } },
  { id: 'reindeer',       kg: 150,    emoji: '🦌', en: { one: 'reindeer', many: 'reindeer' }, he: { one: 'איל צפוני', many: 'איילים צפוניים' } },
  { id: 'scooter',        kg: 180,    emoji: '🛵', en: { one: 'Vespa', many: 'Vespas' }, he: { one: 'וספה', many: 'וספות' } },
  { id: 'lion',           kg: 190,    emoji: '🦁', en: { one: 'lion', many: 'lions' }, he: { one: 'אריה', many: 'אריות' } },
  { id: 'boar',           kg: 220,    emoji: '🐗', en: { one: 'wild boar', many: 'wild boars' }, he: { one: 'חזיר בר', many: 'חזירי בר' } },
  { id: 'gorilla',        kg: 230,    emoji: '🦍', en: { one: 'silverback gorilla', many: 'silverback gorillas' }, he: { one: 'גורילה', many: 'גורילות' } },
  { id: 'harley',         kg: 300,    emoji: '🏍️', en: { one: 'Harley', many: 'Harleys' }, he: { one: 'הארלי', many: 'הארליים' } },
  { id: 'vending',        kg: 330,    emoji: '🥤', en: { one: 'vending machine', many: 'vending machines' }, he: { one: 'מכונת ממכר', many: 'מכונות ממכר' } },
  { id: 'grizzly',        kg: 400,    emoji: '🐻', en: { one: 'grizzly bear', many: 'grizzly bears' }, he: { one: 'דוב גריזלי', many: 'דובי גריזלי' } },
  { id: 'piano',          kg: 450,    emoji: '🎹', en: { one: 'grand piano', many: 'grand pianos' }, he: { one: 'פסנתר כנף', many: 'פסנתרי כנף' } },
  { id: 'camel',          kg: 500,    emoji: '🐪', en: { one: 'camel', many: 'camels' }, he: { one: 'גמל', many: 'גמלים' } },
  { id: 'horse',          kg: 550,    emoji: '🐎', en: { one: 'horse', many: 'horses' }, he: { one: 'סוס', many: 'סוסים' } },
  { id: 'polar-bear',     kg: 600,    emoji: '🐻‍❄️', en: { one: 'polar bear', many: 'polar bears' }, he: { one: 'דוב קוטב', many: 'דובי קוטב' } },
  { id: 'cow',            kg: 750,    emoji: '🐄', en: { one: 'dairy cow', many: 'dairy cows' }, he: { one: 'פרה', many: 'פרות' } },
  { id: 'hot-tub',        kg: 850,    emoji: '🛁', en: { one: 'empty hot tub', many: 'empty hot tubs' }, he: { one: "ג'קוזי ריק", many: "ג'קוזים ריקים" } },
  { id: 'bison',          kg: 900,    emoji: '🦬', en: { one: 'bison', many: 'bison' }, he: { one: 'ביזון', many: 'ביזונים' } },
  { id: 'smart-car',      kg: 950,    emoji: '🚘', en: { one: 'Smart car', many: 'Smart cars' }, he: { one: 'מכונית סמארט', many: 'מכוניות סמארט' } },
  { id: 'great-white',    kg: 1100,   emoji: '🦈', en: { one: 'great white shark', many: 'great white sharks' }, he: { one: 'כריש לבן', many: 'כרישים לבנים' } },
  { id: 'mini',           kg: 1200,   emoji: '🚗', en: { one: 'Mini Cooper', many: 'Mini Coopers' }, he: { one: 'מיני קופר', many: 'מכוניות מיני קופר' } },
  { id: 'giraffe',        kg: 1300,   emoji: '🦒', en: { one: 'giraffe', many: 'giraffes' }, he: { one: "ג'ירפה", many: "ג'ירפות" } },
  { id: 'hippo',          kg: 1500,   emoji: '🦛', en: { one: 'hippo', many: 'hippos' }, he: { one: 'היפופוטם', many: 'היפופוטמים' } },
  { id: 'tesla',          kg: 1800,   emoji: '🔋', en: { one: 'Tesla', many: 'Teslas' }, he: { one: 'טסלה', many: 'טסלות' } },
  { id: 'pickup',         kg: 2000,   emoji: '🛻', en: { one: 'pickup truck', many: 'pickup trucks' }, he: { one: 'טנדר', many: 'טנדרים' } },
  { id: 'rhino',          kg: 2300,   emoji: '🦏', en: { one: 'rhino', many: 'rhinos' }, he: { one: 'קרנף', many: 'קרנפים' } },
  { id: 'van',            kg: 2800,   emoji: '🚐', en: { one: 'camper van', many: 'camper vans' }, he: { one: 'קרוואן', many: 'קרוואנים' } },
  { id: 'mammoth',        kg: 3500,   emoji: '🦣', en: { one: 'woolly mammoth', many: 'woolly mammoths' }, he: { one: 'ממותה', many: 'ממותות' } },
  { id: 'orca',           kg: 4500,   emoji: '🐬', en: { one: 'orca', many: 'orcas' }, he: { one: 'אורקה', many: 'אורקות' } },
  { id: 'elephant',       kg: 6000,   emoji: '🐘', en: { one: 'elephant', many: 'elephants' }, he: { one: 'פיל', many: 'פילים' } },
  { id: 't-rex',          kg: 8000,   emoji: '🦖', en: { one: 'T-Rex', many: 'T-Rexes' }, he: { one: 'טי-רקס', many: 'טי-רקסים' } },
  { id: 'ice-cream-truck',kg: 9000,   emoji: '🍦', en: { one: 'ice-cream truck', many: 'ice-cream trucks' }, he: { one: 'משאית גלידה', many: 'משאיות גלידה' } },
  { id: 'bus',            kg: 12000,  emoji: '🚌', en: { one: 'double-decker bus', many: 'double-decker buses' }, he: { one: 'אוטובוס דו-קומתי', many: 'אוטובוסים דו-קומתיים' } },
  { id: 'fire-truck',     kg: 15000,  emoji: '🚒', en: { one: 'fire truck', many: 'fire trucks' }, he: { one: 'כבאית', many: 'כבאיות' } },
  { id: 'tiny-house',     kg: 20000,  emoji: '🏚️', en: { one: 'tiny house', many: 'tiny houses' }, he: { one: 'בית זעיר', many: 'בתים זעירים' } },
  { id: 'container',      kg: 25000,  emoji: '📦', en: { one: 'loaded shipping container', many: 'loaded shipping containers' }, he: { one: 'מכולה עמוסה', many: 'מכולות עמוסות' } },
  { id: 'humpback',       kg: 30000,  emoji: '🐋', en: { one: 'humpback whale', many: 'humpback whales' }, he: { one: 'לווייתן גדול-סנפיר', many: 'לווייתנים גדולי-סנפיר' } },
  { id: 'tank',           kg: 40000,  emoji: '🪖', en: { one: 'army tank', many: 'army tanks' }, he: { one: 'טנק', many: 'טנקים' } },
  { id: 'moai',           kg: 50000,  emoji: '🗿', en: { one: 'moai statue', many: 'moai statues' }, he: { one: 'פסל מוֹאָי', many: 'פסלי מוֹאָי' } },
  { id: 'brachiosaurus',  kg: 60000,  emoji: '🦕', en: { one: 'brachiosaurus', many: 'brachiosauruses' }, he: { one: 'ברכיוזאורוס', many: 'ברכיוזאורוסים' } },
  { id: 'locomotive',     kg: 90000,  emoji: '🚂', en: { one: 'steam locomotive', many: 'steam locomotives' }, he: { one: 'קטר קיטור', many: 'קטרי קיטור' } },
  { id: 'blue-whale',     kg: 150000, emoji: '🐳', en: { one: 'blue whale', many: 'blue whales' }, he: { one: 'לווייתן כחול', many: 'לווייתנים כחולים' } },
  { id: 'jet',            kg: 200000, emoji: '🛩️', en: { one: 'passenger jet', many: 'passenger jets' }, he: { one: 'מטוס נוסעים', many: 'מטוסי נוסעים' } },
  { id: 'iss',            kg: 420000, emoji: '🛰️', en: { one: 'International Space Station', many: 'International Space Stations' }, he: { one: 'תחנת חלל בינלאומית', many: 'תחנות חלל בינלאומיות' } },
  { id: 'statue-liberty', kg: 900000, emoji: '🗽', en: { one: 'Statue of Liberty', many: 'Statues of Liberty' }, he: { one: 'פסל החירות', many: 'פסלי חירות' } },
];

const THING_BY_ID = new Map(CATALOG.map((t) => [t.id, t]));

// ---------------------------------------------------------------------------
// Sentences. Placeholders: {thing} (localized name; English singular carries
// its a/an), {n} count, {emoji}, plus family-specific ones listed per family.
// Appending a sentence is safe; reordering or deleting one changes stored
// jokes that point at it by index, so append instead.
// ---------------------------------------------------------------------------

type Forms = { one: readonly string[]; many: readonly string[] };
type FamilyCopy = Record<BragLanguage, Forms>;

const THING: FamilyCopy = {
  en: {
    one: [
      'That’s {thing} {emoji} you gently launched into orbit. It’s fine — just a little dizzy.',
      'You lovingly hoisted {thing} {emoji} today. Somewhere, it felt deeply supported.',
      'You relocated {thing} {emoji} using only your muscles and questionable decisions. Iconic.',
      'Scientists confirm you moved {thing} {emoji} today. Scientists are also a little scared.',
      'You vs {thing} {emoji}. Final score: you. It never stood a chance.',
      'Congratulations — you now owe {thing} {emoji} an apology and a nap.',
      'That’s {thing} {emoji} worth of “I’ll just do one more set.” Bold. Respect.',
      'Breaking: {thing} {emoji} spotted leaving the gym with a newfound respect for you.',
      'If {thing} {emoji} needs help moving apartments, it knows who to call now.',
      'Your total today: one {emoji}. Not a metaphor. An actual {emoji}.',
      'You just out-lifted {thing} {emoji}. Its therapist has been notified.',
      'Somewhere, {thing} {emoji} is updating its LinkedIn: “was lifted, would recommend.”',
      'The gym floor asked for a raise after you dropped {thing} {emoji} worth of iron on it.',
      'Forklifts hate this one trick: being you. That was {thing} {emoji}.',
      'Today you were the crane operator, the crane and the crane’s mom. Payload: {thing} {emoji}.',
      'Physics wanted a word about {thing} {emoji} flying around today. Physics lost.',
    ],
    many: [
      'That’s {n} {thing} {emoji} you gently launched into orbit. They’re fine — just a little dizzy.',
      'You lovingly hoisted {n} {thing} {emoji} today. Somewhere, they felt deeply supported.',
      'You relocated {n} {thing} {emoji} using only your muscles and questionable decisions. Iconic.',
      'Scientists confirm you moved {n} {thing} {emoji} today. Scientists are also a little scared.',
      'You vs {n} {thing} {emoji}. Final score: you. They never stood a chance.',
      'Congratulations — you now owe {n} {thing} {emoji} an apology and a nap.',
      'That’s {n} {thing} {emoji} worth of “I’ll just do one more set.” Bold. Respect.',
      'Breaking: {n} {thing} {emoji} spotted leaving the gym with a newfound respect for you.',
      'If {n} {thing} {emoji} need help moving apartments, they know who to call now.',
      'Picture {n} {thing} {emoji} stacked into a wobbly tower. You lifted that. On purpose.',
      'You just out-lifted {n} {thing} {emoji}. Their group therapist has been notified.',
      '{n} {thing} {emoji} have started a fan club. You’re the only topic on the agenda.',
      'The gym floor asked for a raise after you dropped {n} {thing} {emoji} worth of iron on it.',
      'Forklifts hate this one trick: being you. That was {n} {thing} {emoji}.',
      'Today you were the crane operator, the crane and the crane’s mom. Payload: {n} {thing} {emoji}.',
      'Physics wanted a word about the {n} {thing} {emoji} you threw around. Physics lost.',
    ],
  },
  he: {
    one: [
      'זה {thing} {emoji} ששיגרת בעדינות לחלל. הכול בסדר — רק קצת סחרחורת.',
      'הרמת באהבה {thing} {emoji} היום. איפשהו, הרגישו שם תמיכה עמוקה.',
      'העברת {thing} {emoji} ממקום למקום רק בעזרת השרירים והחלטות מפוקפקות. אייקוני.',
      'מדענים אישרו שהזזת {thing} {emoji} היום. המדענים גם קצת מפוחדים.',
      'קרב בינך לבין {thing} {emoji}. ניצחת בגדול.',
      'מגיעה ל{thing} {emoji} התנצלות ותנומה קטנה אחרי מה שקרה היום.',
      'זה {thing} {emoji} של "רק עוד סט אחרון". אמיץ. כל הכבוד.',
      'מבזק מחדר הכושר: אחרי היום, {thing} {emoji} כבר לא הדבר הכי כבד בחדר.',
      'צריך להעביר {thing} {emoji} לדירה חדשה? עכשיו ברור למי להתקשר.',
      'הסכום של היום: {emoji} אחד. לא מטאפורה. {emoji} אמיתי.',
      'הרמת יותר מ{thing} {emoji}. כבר נקבע תור לפסיכולוג.',
      'אי שם, בלינקדאין של {thing} {emoji} נוספה שורה: "הורמתי. חוויה."',
      'הרצפה של חדר הכושר ביקשה העלאה. {thing} {emoji} של ברזל, ככה סתם.',
      'מלגזות שונאות את הטריק הזה: {thing} {emoji}, בלי מלגזה.',
      'היום היית המנוף, מפעיל המנוף וגם אמא של המנוף. מטען: {thing} {emoji}.',
      'הפיזיקה ביקשה הסבר על {thing} {emoji} באוויר. הפיזיקה הפסידה.',
    ],
    many: [
      'זה {n} {thing} {emoji} ששיגרת בעדינות לחלל. הכול בסדר — רק קצת סחרחורת.',
      'הרמת באהבה {n} {thing} {emoji} היום. איפשהו, הרגישו שם תמיכה עמוקה.',
      'העברת {n} {thing} {emoji} ממקום למקום רק בעזרת השרירים והחלטות מפוקפקות. אייקוני.',
      'מדענים אישרו שהזזת {n} {thing} {emoji} היום. המדענים גם קצת מפוחדים.',
      'קרב בינך לבין {n} {thing} {emoji}. ניצחת בגדול.',
      'מגיעה ל-{n} {thing} {emoji} התנצלות ותנומה קטנה אחרי מה שקרה היום.',
      'זה {n} {thing} {emoji} של "רק עוד סט אחרון". אמיץ. כל הכבוד.',
      'מבזק מחדר הכושר: אחרי היום, {n} {thing} {emoji} כבר לא הדבר הכי כבד בחדר.',
      'צריך להעביר {n} {thing} {emoji} לדירה חדשה? עכשיו ברור למי להתקשר.',
      'תארו לעצמכם {n} {thing} {emoji} מוערמים למגדל רעוע. את זה הרמת. בכוונה.',
      'הרמת יותר מ-{n} {thing} {emoji}. כבר נקבע תור לטיפול קבוצתי.',
      'נפתח מועדון מעריצים של {n} {thing} {emoji}. יש רק נושא אחד על סדר היום.',
      'הרצפה של חדר הכושר ביקשה העלאה. {n} {thing} {emoji} של ברזל, ככה סתם.',
      'מלגזות שונאות את הטריק הזה: {n} {thing} {emoji}, בלי מלגזה.',
      'היום היית המנוף, מפעיל המנוף וגם אמא של המנוף. מטען: {n} {thing} {emoji}.',
      'הפיזיקה ביקשה הסבר על {n} {thing} {emoji} באוויר. הפיזיקה הפסידה.',
    ],
  },
};

// {exercise} = exercise name, {reps} = its reps today. The thing is one
// rep's average load, so "one" form only.
const TOP: FamilyCopy = {
  en: {
    one: [
      '{exercise}: you lifted {thing} {emoji} — {reps} times. It would like to get off now.',
      'MVP of the day: {exercise}. Every rep was basically {thing} {emoji}. {reps} of them.',
      '{reps} reps of {exercise}, each one roughly {thing} {emoji}. It has filed for workers’ comp.',
      'On {exercise} you treated {thing} {emoji} like a dumbbell. {reps} times. Unwell (complimentary).',
      'Fun fact: {exercise} today = picking up {thing} {emoji} {reps} times. Not fun for the {emoji}.',
      '{exercise} carried the session. You carried {thing} {emoji}, {reps} times.',
    ],
    many: [],
  },
  he: {
    one: [
      '{exercise}: הרמת {thing} {emoji} — {reps} פעמים. מבקשים לרדת עכשיו.',
      'ה-MVP של היום: {exercise}. כל חזרה הייתה בערך {thing} {emoji}. {reps} כאלה.',
      '{reps} חזרות {exercise}, כל אחת בערך {thing} {emoji}. כבר הוגשה תביעה לביטוח לאומי.',
      'ב{exercise} התייחסת ל{thing} {emoji} כמו למשקולת. {reps} פעמים. לא נורמלי (מחמאה).',
      'עובדה משעשעת: {exercise} היום = להרים {thing} {emoji} {reps} פעמים. פחות משעשע ל{emoji}.',
      '{exercise} סחב את האימון, ובדרך נסחב גם {thing} {emoji}, {reps} פעמים.',
    ],
    many: [],
  },
};

// Up = heavier than last workout by {thing}; down = lighter. Reuses the
// one/many split as up/down.
const VS_LAST: FamilyCopy = {
  en: {
    one: [
      'Today’s you out-lifted last time’s you by exactly {thing} {emoji}. Past you is furious.',
      'Compared to last workout: +{thing} {emoji}. Keep this up and you’ll need a bigger gym.',
      'Last time’s you called, demanding {thing} {emoji} back. Denied.',
      'Progress report: one extra {emoji} since last session. Your muscles are filing it under “growth”.',
    ],
    many: [
      'A bit lighter than last time — about {thing} {emoji} lighter. Recovery days are a strategy ✨.',
      'Last time you were carrying {thing} {emoji} more. Today you let it rest. Very considerate.',
      'Lighter session than last time by {thing} {emoji}. Even rhinos have easy days.',
    ],
  },
  he: {
    one: [
      'הגרסה של היום הרימה יותר מהגרסה של האימון הקודם, בדיוק ב{thing} {emoji}. העבר זועם.',
      'לעומת האימון הקודם: +{thing} {emoji}. ככה ממשיכים — ונצטרך חדר כושר גדול יותר.',
      'הגרסה הקודמת שלך התקשרה ודרשה בחזרה {thing} {emoji}. הבקשה נדחתה.',
      'דוח התקדמות: עוד {thing} {emoji} מאז האימון הקודם. השרירים מתייקים את זה תחת "צמיחה".',
    ],
    many: [
      'קצת יותר קל מהפעם הקודמת — בערך {thing} {emoji} פחות. גם ימי התאוששות הם אסטרטגיה ✨.',
      'בפעם הקודמת סחבת עוד {thing} {emoji}. היום זה קיבל יום מנוחה. ממש התחשבות.',
      'אימון קליל יותר מהקודם ב{thing} {emoji}. גם לקרנפים יש ימים רגועים.',
    ],
  },
};

// {reps}, {sets}, {stairs} = reps as stairs climbed to that many floors.
const REPS: FamilyCopy = {
  en: {
    one: [
      '{sets} sets, {reps} reps. Your muscles have formally requested a union rep.',
      '{reps} reps today. If each rep were a stair, you’d be on floor {stairs} by now. Elevator? Never heard of it.',
      '{reps} reps. That’s {reps} tiny arguments with gravity, and you won every single one.',
      '{sets} sets done. Somewhere a spreadsheet just felt very proud of you.',
      'Rep counter says {reps}. Rep counter also says “please, I have a family”.',
    ],
    many: [],
  },
  he: {
    one: [
      '{sets} סטים, {reps} חזרות. השרירים ביקשו רשמית ועד עובדים.',
      '{reps} חזרות היום. אם כל חזרה הייתה מדרגה, היית כבר בקומה {stairs}. מעלית? מה זה?',
      '{reps} חזרות. זה {reps} ויכוחים קטנים עם כוח המשיכה — וניצחת בכולם.',
      '{sets} סטים הושלמו. אי שם גיליון אקסל מרגיש עכשיו גאווה גדולה.',
      'מונה החזרות אומר {reps}. מונה החזרות גם אומר "בבקשה, יש לי משפחה".',
    ],
    many: [],
  },
};

// {min} minutes, {episodes} sitcom episodes, {eggs} soft-boiled eggs,
// {songs} pop songs that fit in it.
const TIME: FamilyCopy = {
  en: {
    one: [
      '{min} minutes of iron. That’s {episodes} sitcom episodes you didn’t watch. Character development.',
      'You trained for {min} minutes — long enough to soft-boil {eggs} eggs back to back. Protein-adjacent.',
      '{min} minutes in the gym = about {songs} pop songs. Hopefully at least one banger.',
      '{min} minutes. Your phone thinks you were kidnapped. Your quads know the truth.',
    ],
    many: [],
  },
  he: {
    one: [
      '{min} דקות של ברזל. זה {episodes} פרקים של סיטקום שלא ראית. התפתחות דמות.',
      'התאמנת {min} דקות — מספיק כדי להכין {eggs} ביצים רכות ברצף. כמעט חלבון.',
      '{min} דקות בחדר הכושר = בערך {songs} שירי פופ. נקווה שלפחות אחד מהם היה להיט.',
      '{min} דקות. הטלפון חושב שנחטפת. הארבע-ראשי יודע את האמת.',
    ],
    many: [],
  },
};

// {when} picks the band: 0 early (before 7), 1 lunch (12–14), 2 late (21+).
// Stored as the sentence index directly: early 0–2, lunch 3–4, late 5–7.
const HOUR: FamilyCopy = {
  en: {
    one: [
      'Workout done before 7 a.m. The roosters have filed a noise complaint 🐓.',
      'Early session ✔︎. The sun showed up and you were already on your third set ☀️.',
      'You trained before most people found their socks. Unhinged. Admirable.',
      'Lunch-break workout: you swapped a sandwich for a squat. The sandwich is hurt 🥪.',
      'Midday gains 🌞. Your coworkers think you went to the dentist.',
      'Late-night iron 🌙. The gym lights stayed on just for you.',
      'Workout after 9 p.m. Owls are taking notes 🦉.',
      'Night shift complete. Your bed has been waiting very patiently 🛏️.',
    ],
    many: [],
  },
  he: {
    one: [
      'אימון שנגמר לפני 7 בבוקר. התרנגולים הגישו תלונה על רעש 🐓.',
      'אימון מוקדם ✔︎. השמש הגיעה וכבר היית בסט השלישי ☀️.',
      'התאמנת לפני שרוב האנשים מצאו גרביים. לא נורמלי. מעורר השראה.',
      'אימון בהפסקת צהריים: החלפת כריך בסקוואט. הכריך נפגע 🥪.',
      'גיינז של צהריים 🌞. בעבודה חושבים שהלכת לרופא שיניים.',
      'ברזל בלילה 🌙. האורות בחדר הכושר נשארו דולקים רק בשבילך.',
      'אימון אחרי 9 בערב. הינשופים רושמים הערות 🦉.',
      'משמרת לילה הושלמה. המיטה חיכתה בסבלנות רבה 🛏️.',
    ],
    many: [],
  },
};
const HOUR_BANDS: Record<'early' | 'lunch' | 'late', readonly number[]> = {
  early: [0, 1, 2],
  lunch: [3, 4],
  late: [5, 6, 7],
};

const BODYWEIGHT: FamilyCopy = {
  en: {
    one: [
      'No weights today — just you drifting through space on pure good vibes ☁️. The clouds are so proud.',
      'Zero kilos moved, infinite style points earned. Gravity took the day off in your honor 🌬️.',
      'No iron, all willpower today 💫. The floor is genuinely impressed with you.',
      'Just you versus your own bodyweight 🪶. Spoiler: you won, gracefully.',
      'Bodyweight day: you were the gym equipment 🤸. Very reasonably priced.',
      'No plates were harmed in the making of this workout 🍽️. Just your excuses.',
      'You lifted the heaviest thing there is: yourself, off the couch 🛋️.',
    ],
    many: [],
  },
  he: {
    one: [
      'בלי משקולות היום — רק ריחפת בחלל על טהרת הוויבים הטובים ☁️. העננים ממש גאים.',
      'אפס קילו הורמו, אינסוף נקודות סטייל נצברו. הכבידה לקחה יום חופש לכבודך 🌬️.',
      'היום בלי ברזל, רק כוח רצון 💫. הרצפה ממש מתרשמת ממך.',
      'רק גוף, בלי ברזל, היום 🪶. ניצחת בסטייל.',
      'יום משקל גוף: היית הציוד של חדר הכושר 🤸. ובמחיר מצוין.',
      'אף צלחת משקולת לא נפגעה במהלך האימון 🍽️. רק התירוצים.',
      'הרמת את הדבר הכי כבד שיש: הגוף, ישר מהספה 🛋️.',
    ],
    many: [],
  },
};

const COPY: Record<BragFamily, FamilyCopy> = {
  thing: THING,
  top: TOP,
  'vs-last': VS_LAST,
  reps: REPS,
  time: TIME,
  hour: HOUR,
  bodyweight: BODYWEIGHT,
};

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

const MIN_RATIO = 0.8;
const MAX_RATIO = 3.5; // counts of 1, 2 or 3

// Every object a total can honestly be "n of" (n = 1–3).
export function thingCandidates(totalKg: number): { thing: string; n: number }[] {
  const out: { thing: string; n: number }[] = [];
  for (const t of CATALOG) {
    const ratio = totalKg / t.kg;
    if (ratio >= MIN_RATIO && ratio < MAX_RATIO) out.push({ thing: t.id, n: Math.max(1, Math.round(ratio)) });
  }
  if (out.length) return out;
  const heaviest = CATALOG[CATALOG.length - 1];
  if (totalKg >= heaviest.kg) return [{ thing: heaviest.id, n: Math.round(totalKg / heaviest.kg) }];
  return [{ thing: CATALOG[0].id, n: 1 }];
}

// The one object closest to `kg` (for one-rep and difference jokes), or
// null when nothing is within a believable margin.
function nearestThing(kg: number): string | null {
  let best: HeavyThing | null = null;
  let bestErr = Infinity;
  for (const t of CATALOG) {
    const err = Math.abs(Math.log(kg / t.kg));
    if (err < bestErr) { bestErr = err; best = t; }
  }
  return best && bestErr <= Math.log(1.35) ? best.id : null;
}

// Every joke this workout could get, before memory is applied.
export function bragCandidates(facts: BragFacts): BragPick[] {
  const out: BragPick[] = [];
  const add = (f: BragFamily, form: 'one' | 'many', extra: Omit<BragPick, 'v' | 'f' | 't'> = {}, only?: readonly number[]) => {
    const n = COPY[f].en[form].length;
    const idx = only ?? Array.from({ length: n }, (_, i) => i);
    for (const t of idx) out.push({ v: 1, f, t: form === 'many' && f === 'vs-last' ? t + 100 : t, ...extra });
  };

  if (!(facts.totalVolumeKg > 0)) {
    add('bodyweight', 'one');
  } else {
    for (const c of thingCandidates(facts.totalVolumeKg)) {
      add('thing', c.n === 1 ? 'one' : 'many', { thing: c.thing, n: c.n });
    }
    const top = facts.top;
    if (top && top.reps > 0 && top.volumeKg > 0) {
      const perRep = top.volumeKg / top.reps;
      const thing = nearestThing(perRep);
      if (thing) add('top', 'one', { thing, n: 1, x: { exercise: top.id, exName: top.name, reps: top.reps } });
    }
    if (facts.prevVolumeKg && facts.prevVolumeKg > 0) {
      const diff = facts.totalVolumeKg - facts.prevVolumeKg;
      const thing = Math.abs(diff) >= 4 ? nearestThing(Math.abs(diff)) : null;
      if (thing) add('vs-last', diff > 0 ? 'one' : 'many', { thing, n: 1 });
    }
  }
  if (facts.reps >= 20 && facts.setsLogged > 0) {
    add('reps', 'one', { x: { reps: facts.reps, sets: facts.setsLogged, stairs: Math.max(1, Math.round(facts.reps / 16)) } });
  }
  if (facts.minutes !== null && facts.minutes >= 15 && facts.minutes <= 240) {
    const m = Math.round(facts.minutes);
    add('time', 'one', { x: { min: m, episodes: Math.max(1, Math.round(m / 22)), eggs: Math.max(1, Math.round(m / 6)), songs: Math.max(1, Math.round(m / 3.5)) } });
  }
  const h = facts.localHour;
  if (h !== null) {
    const band = h < 7 ? 'early' : h >= 12 && h < 14 ? 'lunch' : h >= 21 ? 'late' : null;
    if (band) add('hour', 'one', {}, HOUR_BANDS[band]);
  }
  return out;
}

const sentenceKey = (p: Pick<BragPick, 'f' | 't'>) => `${p.f}:${p.t}`;

// Pick one joke, steering away from what the user saw recently:
//  - never the same sentence or object as any of the recent picks,
//  - not the same family as the last two picks,
//  - and each family gets an equal chance first (so the 30 "thing" sentences
//    don't drown out the 4 "time" ones), then a sentence within it.
// Each rule is dropped, last first, when it would leave nothing.
// `recent` is newest first. `rand` returns [0, 1).
export function chooseBrag(facts: BragFacts, recent: readonly BragPick[], rand: () => number = Math.random): BragPick {
  const all = bragCandidates(facts);
  const seenSentences = new Set(recent.map(sentenceKey));
  const seenThings = new Set(recent.map((p) => p.thing).filter(Boolean));
  const lastFamilies = new Set(recent.slice(0, 2).map((p) => p.f));

  const filters: ((p: BragPick) => boolean)[] = [
    (p) => !seenSentences.has(sentenceKey(p)),
    (p) => !p.thing || !seenThings.has(p.thing),
    (p) => !lastFamilies.has(p.f),
  ];
  let pool = all;
  for (let k = filters.length; k >= 0; k--) {
    const active = filters.slice(0, k);
    const next = all.filter((p) => active.every((fn) => fn(p)));
    if (next.length) { pool = next; break; }
  }

  const families = [...new Set(pool.map((p) => p.f))];
  const family = families[Math.floor(rand() * families.length)];
  const inFamily = pool.filter((p) => p.f === family);
  return inFamily[Math.floor(rand() * inFamily.length)];
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

function isPick(p: unknown): p is BragPick {
  if (!p || typeof p !== 'object') return false;
  const o = p as Partial<BragPick>;
  return o.v === 1 && typeof o.f === 'string' && o.f in COPY && typeof o.t === 'number';
}

// `exerciseName` localizes {exercise}; it gets the stored id and falls back
// to the English name saved with the pick.
export function renderBrag(
  pick: unknown,
  language: BragLanguage,
  exerciseName?: (id: string) => string | null | undefined,
): string | null {
  if (!isPick(pick)) return null;
  const lang: BragLanguage = language === 'he' ? 'he' : 'en';
  const copy = COPY[pick.f][lang];
  const many = pick.f === 'vs-last' ? pick.t >= 100 : (pick.n ?? 1) > 1;
  const list = many && copy.many.length ? copy.many : copy.one;
  if (!list.length) return null;
  const sentence = list[(pick.f === 'vs-last' ? pick.t % 100 : pick.t) % list.length];

  const thing = pick.thing ? THING_BY_ID.get(pick.thing) : undefined;
  let name = '';
  if (thing) {
    if ((pick.n ?? 1) > 1) name = thing[lang].many;
    else name = lang === 'en' ? withArticle(thing.en.one) : thing.he.one;
  }

  const x = pick.x ?? {};
  const vars: Record<string, string> = {
    thing: name,
    emoji: thing?.emoji ?? '',
    n: String(pick.n ?? 1),
  };
  for (const [k, v] of Object.entries(x)) vars[k] = String(v);
  if (typeof x.exercise === 'string') {
    vars.exercise = exerciseName?.(x.exercise) || String(x.exName ?? x.exercise);
  }
  return sentence.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

// ---------------------------------------------------------------------------
// Fallback for workouts completed before picks were stored
// ---------------------------------------------------------------------------

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small seeded PRNG (mulberry32) so the fallback is stable per workout.
export function seededRandom(seedKey: string): () => number {
  let a = hashSeed(seedKey || 'workout');
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fallbackBrag(totalVolumeKg: number, seedKey: string): BragPick {
  const facts: BragFacts = {
    totalVolumeKg: Number.isFinite(totalVolumeKg) ? totalVolumeKg : 0,
    setsLogged: 0, reps: 0, minutes: null, top: null, prevVolumeKg: null, localHour: null,
  };
  return chooseBrag(facts, [], seededRandom(seedKey));
}

// Stored pick if there is one, else the seeded fallback. Always a line.
export function bragLine(
  stored: unknown,
  totalVolumeKg: number,
  seedKey: string,
  language: BragLanguage,
  exerciseName?: (id: string) => string | null | undefined,
): string {
  return renderBrag(stored, language, exerciseName)
    ?? renderBrag(fallbackBrag(totalVolumeKg, seedKey), language, exerciseName)
    ?? '';
}
