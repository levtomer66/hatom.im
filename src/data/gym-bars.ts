// The bar / attachment catalog for the picker's "Bars" tab: pick the bar in
// your hand (rope, V-bar, W-bar…) and see the exercises done with it. Bars
// aren't per gym: every gym has them, so all of them always show.
//
// Photos are REP Fitness product shots (repfitness.com), resized to 600 px and
// saved under public/workout/bars/ (behind the /workout auth gate, like the
// machine photos). An exercise can sit under more than one bar (a curl works
// on the straight bar and on the W-bar). Import-free for node --test.

export interface GymBar {
  id: string;
  name: string;
  nameHe: string;
  photo: string;
  // Cable attachment or a free bar loaded with plates.
  kind: 'cable' | 'free';
  // Extra search words (slang) — feed the fuzzy search.
  aliases?: string[];
  exerciseIds: string[];
}

const p = (file: string) => `/workout/bars/${file}.jpg`;

export const GYM_BARS: GymBar[] = [
  // ── Cable attachments ──
  {
    id: 'rope', name: 'Rope', nameHe: 'חבל', photo: p('rope'), kind: 'cable',
    aliases: ['tricep rope', 'חבל טרייספס'],
    exerciseIds: ['tricep-pushdown', 'overhead-rope-press', 'face-pull', 'brachialis-rope-curl', 'ab-cable-crunch'],
  },
  {
    id: 'v-bar', name: 'V-Bar', nameHe: 'ידית V', photo: p('v-bar'), kind: 'cable',
    aliases: ['v bar', 'angled bar', 'pushdown bar', 'וי בר'],
    exerciseIds: ['v-bar-pushdown'],
  },
  {
    id: 'row-handle', name: 'Row Handle (Double D)', nameHe: 'ידית משולש', photo: p('row-handle'), kind: 'cable',
    aliases: ['triangle', 'double d', 'close grip handle', 'seated row handle', 'משולש'],
    exerciseIds: ['seated-cable-row', 'close-grip-lat-pulldown'],
  },
  {
    id: 'straight-bar', name: 'Straight Bar', nameHe: 'מוט ישר קצר', photo: p('straight-bar'), kind: 'cable',
    aliases: ['short bar', 'cable bar', 'מוט ישר'],
    exerciseIds: ['straight-bar-pushdown', 'cable-curl', 'upright-row', 'cable-romanian-deadlift', 'front-lever-pulldown'],
  },
  {
    id: 'cable-w-bar', name: 'W-Bar (Cable)', nameHe: 'מוט W לכבל', photo: p('cable-w-bar'), kind: 'cable',
    aliases: ['ez bar', 'curl bar', 'w bar', 'cambered bar', 'מוט W', 'מוט EZ'],
    exerciseIds: ['cable-curl', 'straight-bar-pushdown', 'upright-row'],
  },
  {
    id: 'lat-bar', name: 'Long Lat Bar', nameHe: 'מוט פולי ארוך', photo: p('lat-bar'), kind: 'cable',
    aliases: ['long bar', 'pulldown bar', 'wide bar', 'מוט רחב', 'מוט פולי'],
    exerciseIds: ['wide-grip-lat-pulldown', 'wide-pull-belly', 'front-lever-pulldown'],
  },
  {
    id: 'short-lat-bar', name: 'Short Straight Lat Bar', nameHe: 'מוט פולי ישר קצר', photo: p('short-lat-bar'), kind: 'cable',
    aliases: ['short pulldown bar', 'close grip bar', 'straight pulldown bar', 'מוט קצר', 'מוט פולי קצר'],
    exerciseIds: ['close-grip-lat-pulldown', 'front-lever-pulldown', 'seated-cable-row', 'straight-bar-pushdown'],
  },
  {
    id: 'd-handle', name: 'Single Handle (D)', nameHe: 'ידית יד אחת', photo: p('d-handle'), kind: 'cable',
    aliases: ['d handle', 'stirrup', 'single grip', 'ידית', 'ידיות'],
    exerciseIds: [
      'cable-fly', 'low-to-high-cable', 'high-to-low-cable', 'cable-chest-press',
      'cable-lateral-raise', 'one-hand-cable-pushdown', 'medial-one-arm-pull',
      'bayesian-curl', 'double-arm-bayesian-curl', 'single-arm-lat-pullover',
    ],
  },
  {
    id: 'ankle-strap', name: 'Ankle Strap', nameHe: 'רצועת קרסול', photo: p('ankle-strap'), kind: 'cable',
    aliases: ['ankle cuff', 'קרסול'],
    exerciseIds: ['glute-kickback'],
  },
  // ── Free bars ──
  {
    id: 'olympic-bar', name: 'Olympic Barbell', nameHe: 'מוט אולימפי', photo: p('olympic-bar'), kind: 'free',
    aliases: ['barbell', 'straight barbell', '20kg bar', 'מוט', 'מוט ישר ארוך'],
    exerciseIds: [
      'bench-press', 'incline-bench-press', 'squat', 'front-squat', 'deadlift', 'sumo-deadlift',
      'romanian-deadlift', 'good-morning', 'barbell-hip-thrust', 'bent-over-row', 'military-press',
      'push-press', 'barbell-curl', 'upright-row', 'shrug', 'barbell-pullover',
      'power-clean', 'clean-and-press', 'snatch', 'barbell-wrist-curl', 'reverse-wrist-curl',
    ],
  },
  {
    id: 'ez-bar', name: 'W-Bar (EZ Curl Bar)', nameHe: 'מוט W', photo: p('ez-bar'), kind: 'free',
    aliases: ['ez bar', 'curl bar', 'w bar', 'מוט EZ', 'מוט מעוקל'],
    exerciseIds: ['biceps-preacher-curl', 'barbell-curl', 'skull-crusher', 'upright-row', 'barbell-pullover', 'reverse-wrist-curl'],
  },
  {
    id: 'trap-bar', name: 'Trap Bar (Hex Bar)', nameHe: 'מוט טראפ (משושה)', photo: p('trap-bar'), kind: 'free',
    aliases: ['hex bar', 'trap bar', 'מוט משושה', 'טראפ בר'],
    exerciseIds: ['trap-bar-deadlift', 'shrug'],
  },
];
