// The machine catalog for the machine-grid picker: every machine a gym can
// have. Which gym has which (and what it calls them) is ./gyms.ts, edited in
// the local backoffice at /admin/gyms. Imports only relative .ts files, so
// node --test can load it.
//
// Photos are the makers' product shots (Technogym; Matrix Fitness, converted
// from their transparent PNGs to JPEG on white; the dumbbells tile is Matrix's
// Xult saddle rack) saved under
// public/workout/machines/ (behind the /workout auth gate, so they're never
// served publicly). `brand` says whose machine it is; free weights, benches
// and the bar station are 'generic'.

import { GYMS } from './gyms.ts';
import type { Gym } from '../lib/gym-config.ts';
export { GYMS };
export type { Gym, GymMachineSlot } from '../lib/gym-config.ts';

export type MachineBrand = 'technogym' | 'matrix' | 'generic';

export interface GymMachine {
  id: string;
  name: string;
  nameHe: string;
  // Path under /public, or null for a tile drawn with `icon` only.
  photo: string | null;
  icon?: string;
  brand: MachineBrand;
  // The maker's product line, shown under the name ("Aura", "Magnum").
  series?: string;
  // Extra search words (slang, brand names) — feed the fuzzy search.
  aliases?: string[];
  exerciseIds: string[];
}



const p = (file: string) => `/workout/machines/${file}.jpg`;

// Shared by every brand's cable station / Smith machine.
const CABLE_EXERCISES = [
      'low-to-high-cable', 'high-to-low-cable', 'cable-fly', 'cable-chest-press',
      'tricep-pushdown', 'v-bar-pushdown', 'straight-bar-pushdown', 'one-hand-cable-pushdown', 'overhead-rope-press', 'cable-curl',
      'cable-lateral-raise', 'face-pull', 'medial-one-arm-pull',
      'bayesian-curl', 'double-arm-bayesian-curl', 'brachialis-rope-curl',
      'cable-romanian-deadlift', 'ab-cable-crunch', 'single-arm-lat-pullover'
];
const FLAT_BENCH_EXERCISES = ['bench-press', 'dumbbell-press', 'skull-crusher', 'dumbell-pullover', 'barbell-pullover', 'dumbbell-row', 'barbell-hip-thrust'];
const SMITH_EXERCISES = ['squat', 'bench-press', 'incline-bench-press', 'overhead-press', 'barbell-hip-thrust', 'calf-raise', 'lunge'];

export const GYM_MACHINES: GymMachine[] = [
  {
    id: 'lat-machine', name: 'Lat Machine', nameHe: 'פולי עליון', photo: p('lat-machine'), brand: 'technogym',
    aliases: ['pulldown', 'lat pulldown', 'פולי', 'מתח מכונה'],
    exerciseIds: ['wide-grip-lat-pulldown', 'close-grip-lat-pulldown', 'single-arm-lat-pullover', 'front-lever-pulldown'],
  },
  {
    id: 'low-row', name: 'Low Row', nameHe: 'חתירה בפולי תחתון', photo: p('low-row'), brand: 'technogym',
    aliases: ['seated row', 'cable row', 'פולי תחתון', 'חתירה'],
    exerciseIds: ['seated-cable-row', 'v-bar-pull-belly', 'wide-pull-belly'],
  },
  {
    id: 'row-machine', name: 'Row Machine', nameHe: 'מכונת חתירה', photo: p('row-machine'), brand: 'technogym',
    aliases: ['chest supported row', 'trap row', 'חתירה'],
    exerciseIds: ['trap-row-machine', 'wide-row-rear-delt'],
  },
  {
    id: 'chest-press', name: 'Chest Press', nameHe: 'לחיצת חזה במכונה', photo: p('chest-press'), brand: 'technogym',
    aliases: ['machine press', 'לחיצת חזה'],
    exerciseIds: ['chest-press-machine', 'free-chest-press'],
  },
  {
    id: 'incline-chest-press', name: 'Incline Chest Press', nameHe: 'לחיצת חזה עליון במכונה', photo: p('incline-chest-press'), brand: 'technogym',
    aliases: ['incline machine', 'חזה עליון'],
    exerciseIds: ['incline-chest-machine'],
  },
  {
    id: 'pectoral-reverse-fly', name: 'Pec Deck / Reverse Fly', nameHe: 'פרפר / פרפר הפוך', photo: p('pectoral-reverse-fly'), brand: 'technogym',
    aliases: ['pec deck', 'butterfly', 'fly', 'rear delt', 'פרפר', 'בטרפליי'],
    exerciseIds: ['pec-deck', 'reverse-pec-deck'],
  },
  {
    id: 'shoulder-press', name: 'Shoulder Press', nameHe: 'לחיצת כתפיים במכונה', photo: p('shoulder-press'), brand: 'technogym',
    aliases: ['overhead machine', 'לחיצת כתפיים'],
    exerciseIds: ['machine-shoulder-press'],
  },
  {
    id: 'leg-press', name: 'Leg Press', nameHe: 'לחיצת רגליים', photo: p('leg-press'), brand: 'technogym',
    aliases: ['לג פרס', 'מכבש רגליים'],
    exerciseIds: ['leg-press', 'calfs-leg-press'],
  },
  {
    id: 'hack-squat', name: 'Hack Squat', nameHe: 'האק סקוואט', photo: p('hack-squat'), brand: 'technogym',
    aliases: ['hack', 'האק'],
    exerciseIds: ['hack-squat'],
  },
  {
    id: 'leg-extension', name: 'Leg Extension', nameHe: 'פשיטת ברכיים', photo: p('leg-extension'), brand: 'technogym',
    aliases: ['quad extension', 'פשיטת רגליים'],
    exerciseIds: ['leg-extension'],
  },
  {
    id: 'leg-curl', name: 'Leg Curl', nameHe: 'כפיפת ברכיים', photo: p('leg-curl'), brand: 'technogym',
    aliases: ['hamstring curl', 'כפיפת רגליים'],
    exerciseIds: ['leg-curl', 'prone-leg-curl'],
  },
  {
    id: 'abductor-adductor', name: 'Abductor / Adductor', nameHe: 'מקרבים / מרחיקים', photo: p('abductor-adductor'), brand: 'technogym',
    aliases: ['hip abduction', 'hip adduction', 'מקרב', 'מרחיק'],
    exerciseIds: ['hip-abductors', 'adductors'],
  },
  {
    id: 'multi-hip', name: 'Multi Hip', nameHe: 'מכונת ישבן', photo: p('multi-hip'), brand: 'technogym',
    aliases: ['glute machine', 'kickback', 'ישבן'],
    exerciseIds: ['glute-kick', 'glute-kickback'],
  },
  {
    id: 'hip-thrust', name: 'Hip Thrust', nameHe: 'היפ תראסט', photo: p('hip-thrust'), brand: 'technogym',
    aliases: ['glute bridge', 'היפ טראסט', 'גשר'],
    exerciseIds: ['hip-thrust'],
  },
  {
    id: 'abdominal-crunch', name: 'Abdominal Crunch', nameHe: 'מכונת בטן', photo: p('abdominal-crunch'), brand: 'technogym',
    aliases: ['ab machine', 'crunch', 'כפיפות בטן'],
    exerciseIds: ['abs-machine'],
  },
  {
    id: 'cable-station', name: 'Cable Station', nameHe: 'עמדת כבלים', photo: p('cable-station'), brand: 'technogym',
    aliases: ['dual pulley', 'crossover', 'cable', 'פולי', 'כבל', 'קרוסאובר'],
    exerciseIds: CABLE_EXERCISES,
  },
  {
    id: 'smith-machine', name: 'Smith Machine', nameHe: 'מכונת סמית׳', photo: p('smith-machine'), brand: 'technogym',
    aliases: ['smith', 'multipower', 'סמית'],
    exerciseIds: SMITH_EXERCISES,
  },
  {
    id: 'half-rack', name: 'Squat Rack', nameHe: 'כלוב סקוואט', photo: p('half-rack'), brand: 'technogym',
    aliases: ['rack', 'power rack', 'כלוב', 'מתקן סקוואט'],
    exerciseIds: ['squat', 'front-squat', 'overhead-press', 'military-press', 'push-press', 'good-morning', 'shrug', 'bulgarian-split-squat'],
  },
  {
    id: 'flat-bench', name: 'Flat Bench', nameHe: 'ספסל שטוח', photo: p('flat-bench'), brand: 'technogym',
    aliases: ['bench', 'ספסל'],
    exerciseIds: FLAT_BENCH_EXERCISES,
  },
  {
    id: 'incline-bench', name: 'Incline Bench', nameHe: 'ספסל משופע', photo: p('incline-bench'), brand: 'technogym',
    aliases: ['incline', 'שיפוע', 'ספסל עליון'],
    exerciseIds: ['incline-bench-press', 'incline-dumbbell-press'],
  },
  {
    id: 'military-bench', name: 'Seated Press Bench', nameHe: 'ספסל לחיצת כתפיים', photo: p('military-bench'), brand: 'technogym',
    aliases: ['military bench', 'seated overhead'],
    exerciseIds: ['military-press', 'arnold-press', 'seated-dumbbell-curl'],
  },
  {
    id: 'scott-bench', name: 'Preacher Bench', nameHe: 'ספסל סקוט', photo: p('scott-bench'), brand: 'technogym',
    aliases: ['scott', 'preacher', 'סקוט', 'כפיפת מרפקים'],
    exerciseIds: ['biceps-preacher-curl', 'dumbbell-preacher-curl', 'seated-single-arm-preacher-curl', 'seated-double-arm-preacher-curl'],
  },
  {
    id: 'lower-back-bench', name: 'Back Extension', nameHe: 'ספסל גב תחתון', photo: p('lower-back-bench'), brand: 'technogym',
    aliases: ['hyperextension', 'roman chair', 'גב תחתון'],
    exerciseIds: ['back-extension', 'good-morning'],
  },
  {
    id: 'dumbbells', name: 'Dumbbells', nameHe: 'משקולות יד', photo: p('dumbbells'), brand: 'generic',
    aliases: ['db', 'kettlebell', 'דמבל', 'משקולות', 'קטלבל'],
    exerciseIds: [
      'bicep-dumbbell-curl', 'double-arm-bicep-dumbbell-curl', 'hammer-curl', 'seated-dumbbell-curl',
      'dumbbell-lateral-raise', 'front-raise', 'arnold-press', 'dumbbell-press', 'incline-dumbbell-press',
      'dumbbell-row', 'dumbell-pullover', 'shrug', 'goblet-squat', 'lunge', 'bulgarian-split-squat',
      'single-leg-rdl', 'farmers-walk', 'dumbbell-wrist-curl',
    ],
  },
  {
    id: 'barbell', name: 'Barbell & Platform', nameHe: 'מוט ומשטח', photo: p('barbell'), brand: 'generic',
    aliases: ['bar', 'olympic', 'מוט', 'דדליפט'],
    exerciseIds: [
      'deadlift', 'romanian-deadlift', 'sumo-deadlift', 'barbell-curl', 'bent-over-row', 't-bar-row',
      'upright-row', 'power-clean', 'clean-and-press', 'snatch',
      'barbell-wrist-curl', 'reverse-wrist-curl',
    ],
  },
  {
    id: 'pullup-dip', name: 'Pull-up & Dip Station', nameHe: 'מתח ומקבילים', photo: null, brand: 'generic', icon: '🤸',
    aliases: ['pull up bar', 'dip', 'מתח', 'מקבילים', 'עליות מתח'],
    exerciseIds: [
      'pull-up', 'chin-up', 'weighted-pull-up', 'pull-up-machine', 'negative-pull-up', 'active-hang',
      'dip', 'parallels', 'weighted-parallels', 'negative-dip', 'parallels-assisted',
      'hanging-leg-raise', 'hanging-knee-raise-v3', 'muscle-up', 'l-sit',
    ],
  },

  // ── Matrix Fitness: Aura (selectorized), Aura cable crossover, Magnum
  //    (plate-loaded). Same exercises as the Technogym machine that does the
  //    same job.
  { id: 'matrix-chest-press', name: 'Chest Press', nameHe: 'לחיצת חזה במכונה', brand: 'matrix', series: 'Aura', photo: p('matrix-chest-press'),
    exerciseIds: ['chest-press-machine'] },
  { id: 'matrix-incline-press', name: 'Incline Bench Press', nameHe: 'לחיצת חזה עליון במכונה', brand: 'matrix', series: 'Magnum', photo: p('matrix-incline-press'),
    exerciseIds: ['incline-chest-machine'] },
  // Versa VS-S131: one station for flat, incline and shoulder press (the
  // back pad reclines, dual-position grips).
  { id: 'matrix-multi-press', name: 'Multi Press', nameHe: 'מכונת לחיצות משולבת', brand: 'matrix', series: 'Versa', photo: p('matrix-multi-press'),
    aliases: ['multi-press', 'chest press', 'incline press', 'shoulder press', 'לחיצת חזה', 'לחיצת כתפיים'],
    exerciseIds: ['chest-press-machine', 'incline-chest-machine', 'machine-shoulder-press'] },
  // Ultra G7-S13: independent converging arms.
  { id: 'matrix-converging-chest-press', name: 'Converging Chest Press', nameHe: 'לחיצת חזה מתכנסת', brand: 'matrix', series: 'Ultra', photo: p('matrix-converging-chest-press'),
    aliases: ['chest press', 'converging', 'iso-lateral', 'לחיצת חזה'], exerciseIds: ['chest-press-machine'] },
  { id: 'matrix-pectoral-fly', name: 'Pectoral Fly', nameHe: 'פרפר', brand: 'matrix', series: 'Aura', photo: p('matrix-pectoral-fly'),
    aliases: ['pec deck', 'butterfly', 'פרפר'], exerciseIds: ['pec-deck'] },
  { id: 'matrix-rear-delt-pec-fly', name: 'Rear Delt / Pec Fly', nameHe: 'פרפר / פרפר הפוך', brand: 'matrix', series: 'Aura', photo: p('matrix-rear-delt-pec-fly'),
    aliases: ['pec deck', 'rear delt', 'פרפר'], exerciseIds: ['pec-deck', 'reverse-pec-deck'] },
  { id: 'matrix-shoulder-press', name: 'Shoulder Press', nameHe: 'לחיצת כתפיים במכונה', brand: 'matrix', series: 'Aura', photo: p('matrix-shoulder-press'),
    exerciseIds: ['machine-shoulder-press'] },
  { id: 'matrix-lateral-raise', name: 'Lateral Raise', nameHe: 'הרחקת כתפיים', brand: 'matrix', series: 'Aura', photo: p('matrix-lateral-raise'),
    aliases: ['side raise', 'delts', 'כתפיים'], exerciseIds: ['machine-lateral-raise'] },
  { id: 'matrix-triceps-press', name: 'Triceps Press', nameHe: 'מקבילים בישיבה', brand: 'matrix', series: 'Aura', photo: p('matrix-triceps-press'),
    aliases: ['seated dip', 'dip', 'טרייספס', 'מקבילים'], exerciseIds: ['seated-dip-machine'] },
  { id: 'matrix-triceps-extension', name: 'Triceps Extension', nameHe: 'פשיטת מרפקים', brand: 'matrix', series: 'Aura', photo: p('matrix-triceps-extension'),
    aliases: ['triceps', 'טרייספס'], exerciseIds: ['machine-triceps-extension'] },
  { id: 'matrix-rotary-torso', name: 'Rotary Torso', nameHe: 'סיבובי גו', brand: 'matrix', series: 'Aura', photo: p('matrix-rotary-torso'),
    aliases: ['obliques', 'twist', 'אלכסונים', 'בטן'], exerciseIds: ['rotary-torso'] },
  { id: 'matrix-lat-pulldown', name: 'Lat Pulldown', nameHe: 'פולי עליון', brand: 'matrix', series: 'Aura', photo: p('matrix-lat-pulldown'),
    aliases: ['pulldown', 'פולי'], exerciseIds: ['wide-grip-lat-pulldown', 'close-grip-lat-pulldown'] },
  { id: 'matrix-seated-row', name: 'Seated Row', nameHe: 'חתירה בישיבה', brand: 'matrix', series: 'Aura', photo: p('matrix-seated-row'),
    aliases: ['row', 'חתירה'], exerciseIds: ['trap-row-machine'] },
  { id: 'matrix-t-bar-row', name: 'T-Bar Row', nameHe: 'חתירת T-בר', brand: 'matrix', series: 'Magnum', photo: p('matrix-t-bar-row'),
    aliases: ['t bar', 'חתירה'], exerciseIds: ['t-bar-row'] },
  { id: 'matrix-arm-curl', name: 'Arm Curl', nameHe: 'כפיפת מרפקים במכונה', brand: 'matrix', series: 'Aura', photo: p('matrix-arm-curl'),
    aliases: ['preacher', 'biceps', 'בייספס'], exerciseIds: ['seated-double-arm-preacher-curl', 'seated-single-arm-preacher-curl'] },
  { id: 'matrix-abdominal-crunch', name: 'Abdominal Crunch', nameHe: 'מכונת בטן', brand: 'matrix', series: 'Aura', photo: p('matrix-abdominal-crunch'),
    aliases: ['crunch', 'בטן'], exerciseIds: ['abs-machine'] },
  { id: 'matrix-back-extension', name: 'Back Extension', nameHe: 'פשיטת גב', brand: 'matrix', series: 'Aura', photo: p('matrix-back-extension'),
    aliases: ['lower back', 'גב תחתון'], exerciseIds: ['machine-back-extension'] },
  { id: 'matrix-dip-chin-assist', name: 'Dip / Chin Assist', nameHe: 'מתח ומקבילים בעזרה', brand: 'matrix', series: 'Aura', photo: p('matrix-dip-chin-assist'),
    aliases: ['assisted', 'מתח', 'מקבילים'], exerciseIds: ['pull-up-machine'] },
  { id: 'matrix-leg-press', name: 'Leg Press', nameHe: 'לחיצת רגליים', brand: 'matrix', series: 'Aura', photo: p('matrix-leg-press'),
    aliases: ['לג פרס', 'מכבש'], exerciseIds: ['leg-press', 'calfs-leg-press'] },
  { id: 'matrix-45-leg-press', name: '45° Leg Press', nameHe: 'מכבש רגליים 45°', brand: 'matrix', series: 'Magnum', photo: p('matrix-45-leg-press'),
    aliases: ['leg press', 'לג פרס', 'מכבש'], exerciseIds: ['leg-press', 'calfs-leg-press'] },
  { id: 'matrix-hack-squat', name: 'Hack Squat', nameHe: 'האק סקוואט', brand: 'matrix', series: 'Magnum', photo: p('matrix-hack-squat'),
    aliases: ['hack', 'האק'], exerciseIds: ['hack-squat'] },
  { id: 'matrix-leg-extension', name: 'Leg Extension', nameHe: 'פשיטת ברכיים', brand: 'matrix', series: 'Aura', photo: p('matrix-leg-extension'),
    exerciseIds: ['leg-extension'] },
  { id: 'matrix-seated-leg-curl', name: 'Seated Leg Curl', nameHe: 'כפיפת ברכיים בישיבה', brand: 'matrix', series: 'Aura', photo: p('matrix-seated-leg-curl'),
    aliases: ['hamstring', 'כפיפת ברכיים'], exerciseIds: ['leg-curl'] },
  { id: 'matrix-prone-leg-curl', name: 'Prone Leg Curl', nameHe: 'כפיפת ברכיים בשכיבה', brand: 'matrix', series: 'Aura', photo: p('matrix-prone-leg-curl'),
    aliases: ['lying leg curl', 'hamstring', 'כפיפת ברכיים'], exerciseIds: ['prone-leg-curl'] },
  { id: 'matrix-hip-adductor', name: 'Hip Adductor', nameHe: 'מקרבים', brand: 'matrix', series: 'Aura', photo: p('matrix-hip-adductor'),
    aliases: ['adduction', 'מקרב'], exerciseIds: ['adductors'] },
  { id: 'matrix-hip-abductor', name: 'Hip Abductor', nameHe: 'מרחיקים', brand: 'matrix', series: 'Aura', photo: p('matrix-hip-abductor'),
    aliases: ['abduction', 'מרחיק'], exerciseIds: ['hip-abductors'] },
  { id: 'matrix-glute-trainer', name: 'Glute Trainer', nameHe: 'מכונת ישבן', brand: 'matrix', series: 'Magnum', photo: p('matrix-glute-trainer'),
    aliases: ['hip thrust', 'glute', 'ישבן', 'היפ תראסט'], exerciseIds: ['hip-thrust'] },
  { id: 'matrix-standing-calf', name: 'Standing Calf', nameHe: 'הרמת עקבים בעמידה', brand: 'matrix', series: 'Magnum', photo: p('matrix-standing-calf'),
    aliases: ['calf', 'שוקיים'], exerciseIds: ['calf-raise'] },
  { id: 'matrix-seated-calf', name: 'Seated Calf', nameHe: 'הרמת עקבים בישיבה', brand: 'matrix', series: 'Magnum', photo: p('matrix-seated-calf'),
    aliases: ['calf', 'שוקיים'], exerciseIds: ['seated-calf-raise'] },
  { id: 'matrix-cable-crossover', name: 'Adjustable Cable Crossover', nameHe: 'קרוסאובר כבלים', brand: 'matrix', series: 'Aura', photo: p('matrix-cable-crossover'),
    aliases: ['cable', 'pulley', 'crossover', 'פולי', 'כבל', 'קרוסאובר'], exerciseIds: CABLE_EXERCISES },
  { id: 'matrix-smith-machine', name: 'Smith Machine', nameHe: 'מכונת סמית׳', brand: 'matrix', series: 'Magnum', photo: p('matrix-smith-machine'),
    aliases: ['smith', 'סמית'], exerciseIds: SMITH_EXERCISES },
  // Versa VS-S531: one station, two movements (crunch forward, extend back).
  { id: 'matrix-ab-back', name: 'Ab / Low Back', nameHe: 'בטן / גב תחתון', brand: 'matrix', series: 'Versa', photo: p('matrix-ab-back'),
    aliases: ['crunch', 'back extension', 'lower back', 'בטן', 'גב תחתון'], exerciseIds: ['abs-machine', 'machine-back-extension'] },
  // Aura G3-MS80 8-stack: two adjustable pulleys joined by a crossover bar
  // with a pull-up bar, plus lat pulldown and low row (both dual-pulley) and a
  // triceps pressdown station. Everything a cable column, a lat machine, a low
  // row and a bar can do.
  { id: 'matrix-8-stack', name: '8-Stack Multi-Station', nameHe: 'מולטי-סטיישן 8 עמדות', brand: 'matrix', series: 'Aura', photo: p('matrix-8-stack'),
    aliases: ['multi station', 'multi-station', 'jungle', 'cable', 'crossover', 'lat pulldown', 'low row', 'pull-up', 'פולי', 'כבל', 'קרוסאובר', 'מתח', 'מולטי'],
    exerciseIds: [
      ...CABLE_EXERCISES,
      'wide-grip-lat-pulldown', 'close-grip-lat-pulldown', 'front-lever-pulldown',
      'seated-cable-row', 'wide-pull-belly',
      'glute-kickback',
      'pull-up', 'chin-up', 'hanging-leg-raise', 'active-hang',
    ] },
  // Magnum free-weight benches and stations.
  { id: 'matrix-back-extension-bench', name: 'Back Extension Bench', nameHe: 'ספסל פשיטת גב', brand: 'matrix', series: 'Magnum', photo: p('matrix-back-extension-bench'),
    aliases: ['hyperextension', 'roman chair', '45', 'גב תחתון'], exerciseIds: ['back-extension', 'good-morning'] },
  { id: 'matrix-flat-bench', name: 'Flat Bench', nameHe: 'ספסל שטוח', brand: 'matrix', series: 'Magnum', photo: p('matrix-flat-bench'),
    aliases: ['bench', 'ספסל'], exerciseIds: FLAT_BENCH_EXERCISES },
  { id: 'matrix-standing-arm-curl', name: 'Standing Arm Curl', nameHe: 'עמדת כפיפת מרפקים', brand: 'matrix', series: 'Magnum', photo: p('matrix-standing-arm-curl'),
    aliases: ['preacher', 'scott', 'biceps', 'סקוט', 'כפיפת מרפקים'], exerciseIds: ['biceps-preacher-curl', 'dumbbell-preacher-curl'] },
  { id: 'matrix-ab-bench', name: 'Adjustable Ab Bench', nameHe: 'ספסל בטן מתכוונן', brand: 'matrix', series: 'Magnum', photo: p('matrix-ab-bench'),
    aliases: ['sit-up', 'decline', 'crunch', 'בטן'], exerciseIds: ['decline-crunch'] },
];

export const BRAND_LABELS: Record<MachineBrand, string> = {
  technogym: 'Technogym',
  matrix: 'Matrix',
  generic: '',
};

/** The gym's machines in its order, under the gym's own names where it set them. */
export function machinesForGym(gymId: string | null, gyms: Gym[] = GYMS): GymMachine[] {
  const gym = gyms.find((g) => g.id === gymId) ?? gyms[0];
  if (!gym) return [];
  return gym.machines.flatMap((slot) => {
    const m = GYM_MACHINES.find((x) => x.id === slot.machineId);
    if (!m) return [];
    return [{ ...m, name: slot.name || m.name, nameHe: slot.nameHe || m.nameHe }];
  });
}
