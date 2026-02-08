import { ExerciseDefinition } from '@/types/workout';

// Pexels image URL helper
const pexels = (id: number) => 
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400`;

export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  // =====================
  // CHEST (Push)
  // =====================
  {
    id: 'low-to-high-cable',
    name: 'Low to High Cable Fly',
    hebrewName: 'כבלים מלמטה למעלה',
    description: 'Upper chest isolation with cables',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(32695897), // Cable machine workout
  },
  {
    id: 'pec-deck',
    name: 'Pec Deck',
    hebrewName: 'פק דק',
    description: 'Chest isolation machine',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(18060022), // Chest machine
  },
  {
    id: 'free-chest-press',
    name: 'Free Chest Press',
    hebrewName: 'לחיצת חזה חופשית',
    description: 'Dumbbell chest press on bench',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(7187890), // Dumbbell press
  },
  {
    id: 'high-to-low-cable',
    name: 'High to Low Cable Fly',
    hebrewName: 'כבלים מלמעלה למטה',
    description: 'Lower chest isolation with cables',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(5327510), // Cable machine workout
  },
  {
    id: 'chest-press-machine',
    name: 'Chest Press Machine',
    hebrewName: 'מכונת לחיצת חזה',
    description: 'Seated machine chest press',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(3888104), // Gym machine
  },
  {
    id: 'incline-chest-machine',
    name: 'Incline Chest Press Machine',
    hebrewName: 'מכונת לחיצת חזה עליון',
    description: 'Seated incline machine press',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(3837388), // Gym machine
  },
  {
    id: 'bench-press',
    name: 'Bench Press',
    hebrewName: 'לחיצת חזה מוט',
    description: 'Barbell flat bench press',
    categories: ['push', 'chest', 'triceps'],
    defaultPhoto: pexels(3837781), // Bench press
  },
  {
    id: 'incline-bench-press',
    name: 'Incline Bench Press',
    hebrewName: 'לחיצת חזה עליון מוט',
    description: 'Barbell incline bench press',
    categories: ['push', 'chest', 'triceps'],
    defaultPhoto: pexels(34651540), // Bench press
  },
  {
    id: 'dumbbell-press',
    name: 'Dumbbell Press',
    hebrewName: 'לחיצת חזה משקולות',
    description: 'Flat dumbbell chest press',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(3838698), // Dumbbell workout
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    hebrewName: 'לחיצת חזה עליון משקולות',
    description: 'Incline dumbbell chest press',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(18060077), // Dumbbell workout
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
    hebrewName: 'פתיחות כבלים',
    description: 'Mid-chest cable crossover',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(3837757), // Cable workout
  },
  // =====================
  // TRICEPS (Push)
  // =====================
  {
    id: 'v-bar-pushdown',
    name: 'V-Bar Pushdown',
    hebrewName: 'לחיצת טרייספס V בר',
    description: 'Cable pushdown with V-bar attachment',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(6243176), // Cable pushdown
  },
  {
    id: 'overhead-rope-press',
    name: 'Overhead Rope Extension',
    hebrewName: 'טרייספס חבל מעל הראש',
    description: 'Cable tricep extension overhead',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(14623619), // Cable workout
  },
  {
    id: 'one-hand-cable-pushdown',
    name: 'One Hand Cable Pushdown',
    hebrewName: 'טרייספס יד אחת כבל',
    description: 'Single-arm cable tricep pushdown',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(4164766), // Cable workout
  },
  {
    id: 'medial-one-arm-pull',
    name: 'Medial One Arm Pull',
    hebrewName: 'טרייספס מדיאלי יד אחת',
    description: 'Single-arm tricep medial head focus',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(4164766), // Cable workout
  },
  {
    id: 'tricep-pushdown',
    name: 'Rope Pushdown',
    hebrewName: 'טרייספס חבל',
    description: 'Cable pushdown with rope attachment',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(29218854), // Cable pushdown
  },
  {
    id: 'skull-crusher',
    name: 'Skull Crusher',
    hebrewName: 'סקול קראשר',
    description: 'Lying tricep extension with bar',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(4162438), // Tricep workout
  },
 
  // =====================
  // SHOULDERS (Push)
  // =====================
  {
    id: 'cable-lateral-raise',
    name: 'Cable Lateral Raise',
    hebrewName: 'הרמה צידית כבל',
    description: 'Side delt cable raise (low to 110°)',
    categories: ['push', 'shoulders'],
    defaultPhoto: pexels(3837757), // Cable workout
  },
  {
    id: 'machine-shoulder-press',
    name: 'Shoulder Press Machine',
    hebrewName: 'מכונת כתפיים',
    description: 'Seated machine shoulder press',
    categories: ['push', 'shoulders', 'triceps'],
    defaultPhoto: pexels(4164761), // Machine press
  },
  {
    id: 'overhead-press',
    name: 'Dumbbell Overhead Press',
    hebrewName: 'לחיצת כתפיים משקולות',
    description: 'Seated or standing dumbbell press',
    categories: ['push', 'shoulders', 'triceps'],
    defaultPhoto: pexels(3837781), // Shoulder press
  },
  {
    id: 'front-raise',
    name: 'Single-Arm Front Raise',
    hebrewName: 'הרמה קדמית יד אחת',
    description: 'Front delt dumbbell raise',
    categories: ['push', 'shoulders'],
    defaultPhoto: pexels(3838937), // Dumbbell workout
  },

  // =====================
  // BACK (Pull)
  // =====================
  {
    id: 'wide-grip-lat-pulldown',
    name: 'Wide Grip Lat Pull Down',
    hebrewName: 'מתח עליון אחיזה רחבה',
    description: 'Wide grip cable pulldown for lats',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Lat pulldown
  },
  {
    id: 'close-grip-lat-pulldown',
    name: 'Close Grip Lat Pull Down',
    hebrewName: 'מתח עליון אחיזה צרה',
    description: 'Close grip cable pulldown for lats',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Lat pulldown
  },
  {
    id: 'v-bar-pull-belly',
    name: 'V-Bar Pull to Belly',
    hebrewName: 'חתירה V בר',
    description: 'Seated cable row with V-bar',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Cable row
  },
  {
    id: 'wide-pull-belly',
    name: 'Wide Bar Pull to Belly',
    hebrewName: 'חתירה אחיזה רחבה',
    description: 'Seated wide grip cable row',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Cable row
  },
  {
    id: 'single-arm-lat-pullover',
    name: 'Single Arm Lat Pullover',
    hebrewName: 'פולאובר יד אחת',
    description: 'Cable lat pullover single arm',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Lat workout
  },
  {
    id: 'reverse-pec-deck',
    name: 'Reverse Pec Deck',
    hebrewName: 'פק דק הפוך',
    description: 'Rear delt machine fly',
    categories: ['pull', 'back', 'shoulders'],
    defaultPhoto: pexels(4162579), // Back machine
  },
  {
    id: 'face-pull',
    name: 'Face Pull',
    hebrewName: 'פייס פול',
    description: 'Cable face pull for rear delts',
    categories: ['pull', 'back', 'shoulders'],
    defaultPhoto: pexels(4164766), // Cable face pull
  },
  {
    id: 'dumbbell-row',
    name: 'Dumbbell Row',
    hebrewName: 'חתירה משקולת',
    description: 'Single-arm dumbbell row',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4162438), // Dumbbell row
  },
  {
    id: 'shrug',
    name: 'Shrug',
    hebrewName: 'שראג',
    description: 'Barbell or dumbbell trap shrug',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4162579), // Shrug
  },

  // =====================
  // BICEPS (Pull)
  // =====================
  {
    id: 'bayesian-curl',
    name: 'Single-Arm Bayesian Cable Curl',
    hebrewName: 'ביספס בייסיאן כבל',
    description: 'Cable curl with arm behind body',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4164766), // Cable curl
  },
  {
    id: 'bicep-dumbbell-curl',
    name: 'Single-Arm Dumbbell Curl',
    hebrewName: 'ביספס משקולת יד אחת',
    description: 'Standing alternating dumbbell curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162438), // Dumbbell curl
  },
  {
    id: 'biceps-preacher-curl',
    name: 'Preacher Curl',
    hebrewName: 'ביספס פריצ׳ר',
    description: 'Preacher bench bicep curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162500), // Preacher curl
  },
  {
    id: 'seated-single-arm-preacher-curl',
    name: 'Seated Single-Arm Preacher Curl',
    hebrewName: 'ביספס פריצ׳ר יד אחת',
    description: 'Single-arm preacher machine curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162500), // Preacher curl
  },
  {
    id: 'seated-double-arm-preacher-curl',
    name: 'Seated Double-Arm Preacher Curl',
    hebrewName: 'ביספס פריצ׳ר שתי ידיים',
    description: 'Double-arm preacher machine curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162500), // Preacher curl
  },
  {
    id: 'seated-dumbbell-curl',
    name: 'Seated Dumbbell Curl',
    hebrewName: 'ביספס משקולת בישיבה',
    description: 'Incline seated curl (short head focus)',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162438), // Seated curl
  },
  {
    id: 'brachialis-rope-curl',
    name: 'Brachialis Rope Curl',
    hebrewName: 'ברכיאליס חבל',
    description: 'Rope hammer curl for brachialis',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4164766), // Rope curl
  },
  {
    id: 'hammer-curl',
    name: 'Hammer Curl',
    hebrewName: 'האמר קרל',
    description: 'Neutral grip dumbbell curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162438), // Hammer curl
  },

  // =====================
  // LEGS
  // =====================
  {
    id: 'calfs-leg-press',
    name: 'Calf Press on Leg Press',
    hebrewName: 'שוקיים על מכבש רגליים',
    description: 'Calf raises using leg press machine',
    categories: ['legs', 'calves'],
    defaultPhoto: pexels(4164512), // Leg press
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension Machine',
    hebrewName: 'מכונת יישור רגליים',
    description: 'Seated quad extension',
    categories: ['legs', 'quads'],
    defaultPhoto: pexels(4164512), // Leg machine
  },
  {
    id: 'glute-kick',
    name: 'Glute Kick',
    hebrewName: 'בעיטת ישבן',
    description: 'Machine or cable glute kickback',
    categories: ['legs', 'glutes'],
    defaultPhoto: pexels(4164512), // Glute workout
  },
  {
    id: 'leg-press',
    name: 'Leg Press Machine',
    hebrewName: 'מכבש רגליים',
    description: 'Seated leg press for quads/glutes',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4164512), // Leg press
  },
  {
    id: 'leg-curl',
    name: 'Leg Curl Machine',
    hebrewName: 'מכונת כיפוף רגליים',
    description: 'Seated hamstring curl',
    categories: ['legs', 'hamstrings'],
    defaultPhoto: pexels(4164512), // Leg curl
  },
  {
    id: 'prone-leg-curl',
    name: 'Prone Leg Curl Machine',
    hebrewName: 'כיפוף רגליים שכיבה',
    description: 'Lying hamstring curl',
    categories: ['legs', 'hamstrings'],
    defaultPhoto: pexels(4164512), // Leg curl
  },
  {
    id: 'hip-abductors',
    name: 'Hip Abductors Machine',
    hebrewName: 'פתיחת ירכיים',
    description: 'Outer thigh abduction machine',
    categories: ['legs', 'glutes'],
    defaultPhoto: pexels(4164512), // Hip machine
  },
  {
    id: 'hip-flexors',
    name: 'Hip Adductors Machine',
    hebrewName: 'סגירת ירכיים',
    description: 'Inner thigh adduction machine',
    categories: ['legs', 'glutes'],
    defaultPhoto: pexels(4164512), // Hip machine
  },
  {
    id: 'hip-thrust',
    name: 'Hip Thrust Machine',
    hebrewName: 'היפ ת׳ראסט',
    description: 'Glute-focused hip thrust',
    categories: ['legs', 'glutes'],
    defaultPhoto: pexels(4162451), // Hip thrust
  },
  {
    id: 'squat',
    name: 'Squat',
    hebrewName: 'סקוואט',
    description: 'Barbell back squat',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4164766), // Squat
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    hebrewName: 'מתה רומני',
    description: 'Stiff-leg deadlift for hamstrings',
    categories: ['legs', 'hamstrings', 'glutes'],
    defaultPhoto: pexels(1552252), // Deadlift
  },
  {
    id: 'cable-romanian-deadlift',
    name: 'Cable Romanian Deadlift',
    hebrewName: 'מתה רומני כבל',
    description: 'Cable RDL for hamstrings',
    categories: ['legs', 'hamstrings', 'glutes'],
    defaultPhoto: pexels(1552252), // Deadlift
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    hebrewName: 'מתה',
    description: 'Conventional barbell deadlift',
    categories: ['legs', 'full-body', 'back', 'hamstrings', 'glutes'],
    defaultPhoto: pexels(1552252), // Deadlift barbell
  },
  {
    id: 'lunge',
    name: 'Lunge',
    hebrewName: 'לאנג׳',
    description: 'Walking or stationary lunge',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4162451), // Lunge
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    hebrewName: 'סקוואט בולגרי',
    description: 'Rear-foot elevated split squat',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4162451), // Split squat
  },
  {
    id: 'calf-raise',
    name: 'Standing Calf Raise',
    hebrewName: 'הרמת שוקיים עמידה',
    description: 'Standing calf raise machine',
    categories: ['legs', 'calves'],
    defaultPhoto: pexels(4164512), // Calf raise
  },
  {
    id: 'hack-squat',
    name: 'Hack Squat',
    hebrewName: 'האק סקוואט',
    description: 'Hack squat machine',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4164512), // Hack squat
  },
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    hebrewName: 'גובלט סקוואט',
    description: 'Dumbbell front-loaded squat',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4162438), // Goblet squat
  },
  {
    id: 'sumo-deadlift',
    name: 'Sumo Deadlift',
    hebrewName: 'מתה סומו',
    description: 'Wide stance barbell deadlift',
    categories: ['legs', 'full-body', 'glutes', 'hamstrings', 'back'],
    defaultPhoto: pexels(1552252), // Sumo deadlift
  },
  {
    id: 'glute-kickback',
    name: 'Glute Kickback',
    hebrewName: 'בעיטת ישבן אחורית',
    description: 'Cable or machine glute kickback',
    categories: ['legs', 'glutes'],
    defaultPhoto: pexels(4164512), // Glute kickback
  },
 

  // =====================
  // ABS (Full Body)
  // =====================
  {
    id: 'abs-machine',
    name: 'Abs Machine',
    hebrewName: 'מכונת בטן',
    description: 'Seated ab crunch machine',
    categories: ['full-body', 'abs'],
    defaultPhoto: pexels(4162487), // Abs workout
  },
  {
    id: 'cable-crunch',
    name: 'Cable Crunch',
    hebrewName: 'כפיפות בטן כבל',
    description: 'Kneeling cable ab crunch',
    categories: ['full-body', 'abs'],
    defaultPhoto: pexels(4162487), // Cable crunch
  },
  {
    id: 'ab-wheel',
    name: 'Ab Wheel',
    hebrewName: 'גלגל בטן',
    description: 'Ab wheel rollout',
    categories: ['full-body', 'calisthenics', 'abs'],
    defaultPhoto: pexels(4162487), // Ab wheel
  },
  {
    id: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    hebrewName: 'הרמת רגליים בתלייה',
    description: 'Hanging knee or leg raise',
    categories: ['calisthenics', 'full-body', 'abs'],
    defaultPhoto: pexels(4162451), // Hanging leg raise
  },
  {
    id: 'plank',
    name: 'Plank',
    hebrewName: 'פלאנק',
    description: 'Core stability hold',
    categories: ['calisthenics', 'full-body', 'abs'],
    defaultPhoto: pexels(4162487), // Plank
  },

  // =====================
  // CALISTHENICS
  // =====================
  {
    id: 'pull-up',
    name: 'Pull-Up',
    hebrewName: 'מתח',
    description: 'Overhand grip pull-up',
    categories: ['calisthenics', 'pull', 'back', 'biceps'],
    defaultPhoto: pexels(4162451), // Pull-up bar
  },
  {
    id: 'parallels',
    name: 'Parallel Bars Dip',
    hebrewName: 'מקבילים',
    description: 'Bodyweight parallel bar dip',
    categories: ['calisthenics', 'push', 'chest', 'triceps'],
    defaultPhoto: pexels(4162451), // Parallel bars
  },
  {
    id: 'weighted-parallels',
    name: 'Weighted Parallel Bars Dip',
    hebrewName: 'מקבילים עם משקל',
    description: 'Weighted parallel bar dip',
    categories: ['calisthenics', 'push', 'chest', 'triceps'],
    defaultPhoto: pexels(4162451), // Weighted dip
  },
  {
    id: 'chin-up',
    name: 'Chin-Up',
    hebrewName: 'מתח אחיזה הפוכה',
    description: 'Underhand grip chin-up',
    categories: ['calisthenics', 'pull', 'back', 'biceps'],
    defaultPhoto: pexels(4162451), // Chin-up
  },
  {
    id: 'push-up',
    name: 'Push-Up',
    hebrewName: 'שכיבות סמיכה',
    description: 'Bodyweight push-up',
    categories: ['calisthenics', 'push', 'chest', 'triceps'],
    defaultPhoto: pexels(4162438), // Push-up
  },
  {
    id: 'dip',
    name: 'Bench Dips',
    hebrewName: 'טבילות על ספסל',
    description: 'Tricep dips on bench',
    categories: ['calisthenics', 'push', 'triceps'],
    defaultPhoto: pexels(4162451), // Dip
  },
  {
    id: 'muscle-up',
    name: 'Muscle-Up',
    hebrewName: 'מאסל אפ',
    description: 'Bar or ring muscle-up',
    categories: ['calisthenics', 'full-body', 'back', 'chest', 'triceps'],
    defaultPhoto: pexels(4162451), // Muscle-up
  },
  {
    id: 'pistol-squat',
    name: 'Pistol Squat',
    hebrewName: 'סקוואט על רגל אחת',
    description: 'Single-leg bodyweight squat',
    categories: ['calisthenics', 'legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4162451), // Pistol squat
  },
  {
    id: 'inverted-row',
    name: 'Inverted Row',
    hebrewName: 'חתירה הפוכה',
    description: 'Bodyweight horizontal row',
    categories: ['calisthenics', 'pull', 'back'],
    defaultPhoto: pexels(4162485), // Inverted row
  },
  {
    id: 'l-sit',
    name: 'L-Sit',
    hebrewName: 'אל סיט',
    description: 'Isometric L-sit hold',
    categories: ['calisthenics', 'full-body', 'abs'],
    defaultPhoto: pexels(4162451), // L-sit
  },

  // =====================
  // FULL BODY
  // =====================
  // {
  //   id: 'clean-and-press',
  //   name: 'Clean and Press',
  //   categories: ['full-body'],
  //   defaultPhoto: pexels(1552252), // Barbell clean
  // },
  // {
  //   id: 'thruster',
  //   name: 'Thruster',
  //   categories: ['full-body'],
  //   defaultPhoto: pexels(4162438), // Thruster
  // },
  // {
  //   id: 'burpee',
  //   name: 'Burpee',
  //   categories: ['full-body', 'calisthenics'],
  //   defaultPhoto: pexels(4162487), // Burpee
  // },
  // {
  //   id: 'kettlebell-swing',
  //   name: 'Kettlebell Swing',
  //   categories: ['full-body'],
  //   defaultPhoto: pexels(4162438), // Kettlebell
  // },
  // {
  //   id: 'farmers-walk',
  //   name: 'Farmer\'s Walk',
  //   categories: ['full-body'],
  //   defaultPhoto: pexels(4162438), // Farmers walk
  // },
  // {
  //   id: 'upright-row',
  //   name: 'Upright Row',
  //   categories: ['pull'],
  //   defaultPhoto: pexels(1552252), // Upright row
  // },
];

// Helper to get exercise by ID
export function getExerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISE_LIBRARY.find(e => e.id === id);
}

// Helper to filter exercises by workout type categories
export function filterExercisesByCategories(
  categories: string[]
): ExerciseDefinition[] {
  return EXERCISE_LIBRARY.filter(exercise =>
    exercise.categories.some(cat => categories.includes(cat))
  );
}
