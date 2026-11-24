// PROTOTYPE — movements and their variants.
//
// A movement is what you'd call the exercise in the gym ("Shoulder Press").
// Each variant is one existing library exercise id plus the tags that tell
// it apart (Machine / Dumbbells, Incline, Rope, Single-arm…). Ids are the
// existing ones, so history, PRs and progress stay per variant with no
// migration. Library exercises not listed here show as a movement with one
// variant (mobility drills, skills).
//
// Import-free for node --test.

export type Equipment =
  | 'machine' | 'barbell' | 'ez-bar' | 'dumbbells' | 'cable' | 'smith' | 'bodyweight' | 't-bar' | 'trap-bar';

export interface VariantTags {
  equipment: Equipment;
  angle?: 'flat' | 'incline' | 'decline' | 'low-to-high' | 'high-to-low';
  position?: 'seated' | 'standing' | 'lying' | 'chest-supported' | 'bent-over' | 'on-bench' | 'inverted' | 'on-leg-press' | 'bench';
  grip?: 'wide' | 'close' | 'underhand' | 'neutral' | 'reverse';
  attachment?: 'rope' | 'v-bar' | 'straight-bar' | 'handle';
  style?: 'weighted' | 'assisted' | 'feet-assisted' | 'negative' | 'static' | 'arnold' | 'bayesian' | 'front' | 'back' | 'goblet' | 'sumo' | 'conventional' | 'nordic' | 'straight-legs' | 'knees' | 'bulgarian';
  side?: 'single';
}

export interface Variant {
  exerciseId: string;
  tags: VariantTags;
}

export interface Movement {
  id: string;
  name: string;
  nameHe: string;
  variants: Variant[];
}

const v = (exerciseId: string, tags: VariantTags): Variant => ({ exerciseId, tags });

// Duplicates the review proposes merging (docs/workout-exercise-library-review.md
// §2). The picker hides them; history still resolves them by id.
export const MERGED_AWAY: Record<string, string> = {
  'free-chest-press': 'dumbbell-press',
  'v-bar-pull-belly': 'seated-cable-row',
  'glute-kick': 'glute-kickback',
};

export const MOVEMENTS: Movement[] = [
  // ── Chest ──
  { id: 'chest-press', name: 'Chest Press', nameHe: 'לחיצת חזה', variants: [
    v('chest-press-machine', { equipment: 'machine', angle: 'flat' }),
    v('incline-chest-machine', { equipment: 'machine', angle: 'incline' }),
    v('bench-press', { equipment: 'barbell', angle: 'flat' }),
    v('incline-bench-press', { equipment: 'barbell', angle: 'incline' }),
    v('dumbbell-press', { equipment: 'dumbbells', angle: 'flat' }),
    v('incline-dumbbell-press', { equipment: 'dumbbells', angle: 'incline' }),
    v('cable-chest-press', { equipment: 'cable' }),
  ] },
  { id: 'chest-fly', name: 'Chest Fly', nameHe: 'פרפר חזה', variants: [
    v('pec-deck', { equipment: 'machine' }),
    v('cable-fly', { equipment: 'cable' }),
    v('low-to-high-cable', { equipment: 'cable', angle: 'low-to-high' }),
    v('high-to-low-cable', { equipment: 'cable', angle: 'high-to-low' }),
  ] },
  { id: 'pullover', name: 'Pullover', nameHe: 'פולאובר', variants: [
    v('dumbell-pullover', { equipment: 'dumbbells' }),
    v('barbell-pullover', { equipment: 'barbell' }),
    v('single-arm-lat-pullover', { equipment: 'cable', side: 'single' }),
  ] },
  { id: 'dip', name: 'Dip', nameHe: 'מקבילים', variants: [
    v('parallels', { equipment: 'bodyweight' }),
    v('weighted-parallels', { equipment: 'bodyweight', style: 'weighted' }),
    v('parallels-assisted', { equipment: 'bodyweight', style: 'feet-assisted' }),
    v('negative-dip', { equipment: 'bodyweight', style: 'negative' }),
    v('dip', { equipment: 'bodyweight', position: 'bench' }),
    v('seated-dip-machine', { equipment: 'machine', position: 'seated' }),
  ] },

  // ── Triceps ──
  { id: 'triceps-pushdown', name: 'Triceps Pushdown', nameHe: 'פשיטת מרפקים בכבל', variants: [
    v('tricep-pushdown', { equipment: 'cable', attachment: 'rope' }),
    v('v-bar-pushdown', { equipment: 'cable', attachment: 'v-bar' }),
    v('straight-bar-pushdown', { equipment: 'cable', attachment: 'straight-bar' }),
    v('one-hand-cable-pushdown', { equipment: 'cable', attachment: 'handle', side: 'single' }),
    v('medial-one-arm-pull', { equipment: 'cable', attachment: 'handle', grip: 'reverse', side: 'single' }),
  ] },
  { id: 'triceps-extension', name: 'Triceps Extension', nameHe: 'פשיטת מרפקים', variants: [
    v('machine-triceps-extension', { equipment: 'machine', position: 'seated' }),
  ] },
  { id: 'overhead-extension', name: 'Overhead Triceps Extension', nameHe: 'פשיטת מרפקים מעל הראש', variants: [
    v('overhead-rope-press', { equipment: 'cable', attachment: 'rope' }),
  ] },

  // ── Shoulders ──
  { id: 'shoulder-press', name: 'Shoulder Press', nameHe: 'לחיצת כתפיים', variants: [
    v('machine-shoulder-press', { equipment: 'machine' }),
    v('overhead-press', { equipment: 'dumbbells' }),
    v('arnold-press', { equipment: 'dumbbells', style: 'arnold' }),
    v('military-press', { equipment: 'barbell', position: 'standing' }),
  ] },
  { id: 'lateral-raise', name: 'Lateral Raise', nameHe: 'הרחקת כתפיים', variants: [
    v('dumbbell-lateral-raise', { equipment: 'dumbbells' }),
    v('cable-lateral-raise', { equipment: 'cable' }),
    v('machine-lateral-raise', { equipment: 'machine' }),
  ] },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', nameHe: 'פרפר הפוך', variants: [
    v('reverse-pec-deck', { equipment: 'machine' }),
  ] },

  // ── Back ──
  { id: 'lat-pulldown', name: 'Lat Pulldown', nameHe: 'פולי עליון', variants: [
    v('wide-grip-lat-pulldown', { equipment: 'cable', grip: 'wide' }),
    v('close-grip-lat-pulldown', { equipment: 'cable', grip: 'close' }),
  ] },
  { id: 'pull-up', name: 'Pull-Up', nameHe: 'מתח', variants: [
    v('pull-up', { equipment: 'bodyweight' }),
    v('chin-up', { equipment: 'bodyweight', grip: 'underhand' }),
    v('weighted-pull-up', { equipment: 'bodyweight', style: 'weighted' }),
    v('pull-up-machine', { equipment: 'machine', style: 'assisted' }),
    v('negative-pull-up', { equipment: 'bodyweight', style: 'negative' }),
    v('static-pull-up', { equipment: 'bodyweight', style: 'static' }),
  ] },
  { id: 'row', name: 'Row', nameHe: 'חתירה', variants: [
    v('seated-cable-row', { equipment: 'cable', position: 'seated', attachment: 'v-bar' }),
    v('wide-pull-belly', { equipment: 'cable', position: 'seated', grip: 'wide' }),
    v('trap-row-machine', { equipment: 'machine', position: 'chest-supported' }),
    v('dumbbell-row', { equipment: 'dumbbells', position: 'on-bench', side: 'single' }),
    v('bent-over-row', { equipment: 'barbell', position: 'bent-over' }),
    v('t-bar-row', { equipment: 't-bar', position: 'bent-over' }),
    v('inverted-row', { equipment: 'bodyweight', position: 'inverted' }),
    v('wide-row-rear-delt', { equipment: 'bodyweight', position: 'inverted', grip: 'wide' }),
    v('static-row-hold', { equipment: 'bodyweight', position: 'inverted', style: 'static' }),
  ] },

  // ── Biceps / forearms ──
  { id: 'biceps-curl', name: 'Biceps Curl', nameHe: 'כפיפת מרפקים', variants: [
    v('double-arm-bicep-dumbbell-curl', { equipment: 'dumbbells' }),
    v('bicep-dumbbell-curl', { equipment: 'dumbbells', side: 'single' }),
    v('seated-dumbbell-curl', { equipment: 'dumbbells', angle: 'incline' }),
    v('hammer-curl', { equipment: 'dumbbells', grip: 'neutral' }),
    v('barbell-curl', { equipment: 'barbell' }),
    v('double-arm-bayesian-curl', { equipment: 'cable', style: 'bayesian' }),
    v('bayesian-curl', { equipment: 'cable', style: 'bayesian', side: 'single' }),
    v('brachialis-rope-curl', { equipment: 'cable', attachment: 'rope', grip: 'neutral' }),
    v('cable-curl', { equipment: 'cable', attachment: 'straight-bar' }),
  ] },
  { id: 'preacher-curl', name: 'Preacher Curl', nameHe: 'כפיפת מרפקים בספסל סקוט', variants: [
    v('seated-double-arm-preacher-curl', { equipment: 'machine' }),
    v('seated-single-arm-preacher-curl', { equipment: 'machine', side: 'single' }),
    v('biceps-preacher-curl', { equipment: 'ez-bar' }),
    v('dumbbell-preacher-curl', { equipment: 'dumbbells', side: 'single' }),
  ] },
  { id: 'wrist-curl', name: 'Wrist Curl', nameHe: 'כפיפת שורש כף היד', variants: [
    v('barbell-wrist-curl', { equipment: 'barbell' }),
    v('dumbbell-wrist-curl', { equipment: 'dumbbells' }),
    v('reverse-wrist-curl', { equipment: 'barbell', grip: 'reverse' }),
  ] },

  // ── Legs ──
  { id: 'squat', name: 'Squat', nameHe: 'סקוואט', variants: [
    v('squat', { equipment: 'barbell', style: 'back' }),
    v('front-squat', { equipment: 'barbell', style: 'front' }),
    v('goblet-squat', { equipment: 'dumbbells', style: 'goblet' }),
    v('hack-squat', { equipment: 'machine' }),
    v('deep-squat-bw', { equipment: 'bodyweight' }),
  ] },
  { id: 'split-squat', name: 'Split Squat', nameHe: 'ספליט סקוואט', variants: [
    v('bulgarian-split-squat', { equipment: 'dumbbells', style: 'bulgarian' }),
    v('split-squat-bw', { equipment: 'bodyweight' }),
  ] },
  { id: 'deadlift', name: 'Deadlift', nameHe: 'דדליפט', variants: [
    v('deadlift', { equipment: 'barbell', style: 'conventional' }),
    v('sumo-deadlift', { equipment: 'barbell', style: 'sumo' }),
    v('trap-bar-deadlift', { equipment: 'trap-bar' }),
  ] },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', nameHe: 'דדליפט רומני', variants: [
    v('romanian-deadlift', { equipment: 'barbell' }),
    v('cable-romanian-deadlift', { equipment: 'cable' }),
    v('single-leg-rdl', { equipment: 'bodyweight', side: 'single' }),
  ] },
  { id: 'leg-curl', name: 'Leg Curl', nameHe: 'כפיפת ברכיים', variants: [
    v('leg-curl', { equipment: 'machine', position: 'seated' }),
    v('prone-leg-curl', { equipment: 'machine', position: 'lying' }),
    v('nordic-curl', { equipment: 'bodyweight', style: 'nordic' }),
  ] },
  { id: 'calf-raise', name: 'Calf Raise', nameHe: 'הרמת עקבים', variants: [
    v('calf-raise', { equipment: 'machine', position: 'standing' }),
    v('calfs-leg-press', { equipment: 'machine', position: 'on-leg-press' }),
    v('seated-calf-raise', { equipment: 'machine', position: 'seated' }),
  ] },
  { id: 'hip-thrust', name: 'Hip Thrust', nameHe: 'היפ ת׳ראסט', variants: [
    v('hip-thrust', { equipment: 'machine' }),
    v('barbell-hip-thrust', { equipment: 'barbell' }),
  ] },

  // ── Core ──
  { id: 'ab-crunch', name: 'Ab Crunch', nameHe: 'כפיפות בטן', variants: [
    v('abs-machine', { equipment: 'machine' }),
    v('ab-cable-crunch', { equipment: 'cable' }),
    v('decline-crunch', { equipment: 'bodyweight', angle: 'decline' }),
  ] },
  { id: 'back-extension', name: 'Back Extension', nameHe: 'פשיטת גב', variants: [
    v('back-extension', { equipment: 'bodyweight', position: 'bench' }),
    v('machine-back-extension', { equipment: 'machine', position: 'seated' }),
  ] },
  { id: 'hanging-raise', name: 'Hanging Raise', nameHe: 'הרמות בתלייה', variants: [
    v('hanging-leg-raise', { equipment: 'bodyweight', style: 'straight-legs' }),
    v('hanging-knee-raise-v3', { equipment: 'bodyweight', style: 'knees' }),
  ] },
];

// Single-variant movements whose display name changes per the review
// (no "Machine" suffix). Everything else keeps its library name.
export const RENAMED_SINGLES: Record<string, { name: string; nameHe: string }> = {
  'leg-press': { name: 'Leg Press', nameHe: 'מכבש רגליים' },
  'leg-extension': { name: 'Leg Extension', nameHe: 'פשיטת ברכיים' },
  'hip-abductors': { name: 'Hip Abduction', nameHe: 'הרחקת ירכיים' },
  'adductors': { name: 'Hip Adduction', nameHe: 'קירוב ירכיים' },
  'front-lever-pulldown': { name: 'Straight-Arm Pulldown', nameHe: 'פולי בידיים ישרות' },
};

type Lang = 'en' | 'he';
type TagKey = keyof VariantTags;

// Label order on the chip: what you hold first, then how you stand, then detail.
const TAG_ORDER: TagKey[] = ['equipment', 'angle', 'position', 'grip', 'attachment', 'style', 'side'];

const TAG_LABELS: Record<string, { en: string; he: string }> = {
  machine: { en: 'Machine', he: 'מכונה' },
  barbell: { en: 'Barbell', he: 'מוט' },
  'ez-bar': { en: 'EZ bar', he: 'מוט W' },
  dumbbells: { en: 'Dumbbells', he: 'משקולות' },
  cable: { en: 'Cable', he: 'כבל' },
  smith: { en: 'Smith', he: 'סמית׳' },
  bodyweight: { en: 'Bodyweight', he: 'משקל גוף' },
  't-bar': { en: 'T-bar', he: 'T-בר' },
  'trap-bar': { en: 'Trap bar', he: 'מוט טראפ' },
  flat: { en: 'Flat', he: 'שטוח' },
  incline: { en: 'Incline', he: 'משופע' },
  decline: { en: 'Decline', he: 'שיפוע שלילי' },
  'low-to-high': { en: 'Low → high', he: 'מלמטה למעלה' },
  'high-to-low': { en: 'High → low', he: 'מלמעלה למטה' },
  seated: { en: 'Seated', he: 'בישיבה' },
  standing: { en: 'Standing', he: 'בעמידה' },
  lying: { en: 'Lying', he: 'בשכיבה' },
  'chest-supported': { en: 'Chest-supported', he: 'בתמיכת חזה' },
  'bent-over': { en: 'Bent-over', he: 'בהטיה' },
  'on-bench': { en: 'On bench', he: 'על ספסל' },
  inverted: { en: 'Inverted', he: 'הפוכה' },
  'on-leg-press': { en: 'On leg press', he: 'במכבש' },
  bench: { en: 'Bench', he: 'ספסל' },
  wide: { en: 'Wide grip', he: 'אחיזה רחבה' },
  close: { en: 'Close grip', he: 'אחיזה צרה' },
  underhand: { en: 'Underhand', he: 'אחיזה הפוכה' },
  neutral: { en: 'Neutral grip', he: 'אחיזה ניטרלית' },
  reverse: { en: 'Reverse grip', he: 'אחיזה הפוכה' },
  rope: { en: 'Rope', he: 'חבל' },
  'v-bar': { en: 'V-bar', he: 'V-בר' },
  'straight-bar': { en: 'Straight bar', he: 'מוט ישר' },
  handle: { en: 'Handle', he: 'ידית' },
  weighted: { en: 'Weighted', he: 'עם משקל' },
  assisted: { en: 'Assisted', he: 'בעזרה' },
  'feet-assisted': { en: 'Feet-assisted', he: 'בעזרת רגליים' },
  negative: { en: 'Negative', he: 'שלילי' },
  static: { en: 'Static hold', he: 'החזקה סטטית' },
  arnold: { en: 'Arnold', he: 'ארנולד' },
  bayesian: { en: 'Bayesian', he: 'בייסיאן' },
  front: { en: 'Front', he: 'קדמי' },
  back: { en: 'Back', he: 'אחורי' },
  goblet: { en: 'Goblet', he: 'גובלט' },
  sumo: { en: 'Sumo', he: 'סומו' },
  conventional: { en: 'Conventional', he: 'קלאסי' },
  nordic: { en: 'Nordic', he: 'נורדי' },
  'straight-legs': { en: 'Straight legs', he: 'רגליים ישרות' },
  knees: { en: 'Knees', he: 'ברכיים' },
  bulgarian: { en: 'Bulgarian', he: 'בולגרי' },
  single: { en: 'Single-arm', he: 'יד אחת' },
};

export function tagLabel(value: string, lang: Lang): string {
  return TAG_LABELS[value]?.[lang] ?? value;
}

// The chip labels for one variant, in TAG_ORDER. Single-leg movements say
// "Single-leg" instead of "Single-arm".
export function variantTagLabels(
  tags: VariantTags, lang: Lang, movementId?: string, opts: { skipEquipment?: boolean; skipAttachment?: boolean } = {},
): string[] {
  const legs = movementId === 'romanian-deadlift' || movementId === 'split-squat';
  return TAG_ORDER.flatMap((k) => {
    const value = tags[k];
    if (!value) return [];
    // Inside a machine tile the equipment is the machine itself.
    if (k === 'equipment' && opts.skipEquipment) return [];
    // Inside a bar tile the attachment is the bar itself.
    if (k === 'attachment' && opts.skipAttachment) return [];
    if (k === 'side' && legs) return [lang === 'he' ? 'רגל אחת' : 'Single-leg'];
    return [tagLabel(value, lang)];
  });
}

// exerciseId → its movement and variant (only for listed movements).
export function movementIndex(): Map<string, { movement: Movement; variant: Variant }> {
  const map = new Map<string, { movement: Movement; variant: Variant }>();
  for (const movement of MOVEMENTS) {
    for (const variant of movement.variants) map.set(variant.exerciseId, { movement, variant });
  }
  return map;
}
