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
    name: 'Narrow Grip Lat Pull Down',
    hebrewName: 'מתח עליון אחיזה צרה',
    description: 'Narrow grip cable pulldown for lats',
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
    id: 'dumbell-pullover',
    name: 'Dumbell Pullover',
    hebrewName: 'פולאובר משקולת',
    description: 'Dumbell pullover',
    categories: ['pull', 'back', 'chest'],
    defaultPhoto: pexels(4162438), // Dumbell workout
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
  {
    id: 'trap-row-machine',
    name: 'Trap Row Machine',
    hebrewName: 'חתירה לטרפזים במכונה',
    description: 'Seated machine row targeting upper back and traps',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4162579), // Machine row
  },

  // =====================
  // BICEPS (Pull)
  // =====================
  {
    id: 'bayesian-curl',
    name: 'Single-Arm Bayesian Cable Curl',
    hebrewName: 'ביספס בייסיאן כבל יד אחת',
    description: 'Cable curl with arm behind body',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4164766), // Cable curl
  },
  {
    id: 'double-arm-bayesian-curl',
    name: 'Double-Arm Bayesian Curl',
    hebrewName: 'ביספס בייסיאן כבל שתי ידיים',
    description: 'Cable curl with both arms behind body',
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
    id: 'double-arm-bicep-dumbbell-curl',
    name: 'Double-Arm Dumbbell Curl',
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
    id: 'ab-cable-crunch',
    name: 'Abdominal Cable Crunch',
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
    id: 'pull-up-machine',
    name: 'Pull-Up Machine',
    hebrewName: 'מכונת מתח',
    description: 'Machine pull-up',
    categories: ['calisthenics', 'pull', 'back'],
    defaultPhoto: pexels(4162451), // Pull-up machine
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
  // ATLAS CALISTHENICS — UPPER BODY
  // Skill progressions, scap work, holds, and transitions from the Atlas program
  // =====================
  { id: 'active-hang',                name: 'Active Hang',                         hebrewName: 'תליה אקטיבית',              description: 'Scap-engaged dead hang on bar',                 categories: ['calisthenics', 'back', 'shoulders'],                  defaultPhoto: pexels(4162451) },
  { id: 'vertical-support',           name: 'Vertical Support',                    hebrewName: 'תמיכה אנכית',               description: 'Straight-arm support hold on parallel bars',    categories: ['calisthenics', 'push', 'shoulders', 'triceps'],       defaultPhoto: pexels(4162451) },
  { id: 'elevated-push-up',           name: 'Elevated Push-Up',                    hebrewName: 'שכיבות סמיכה בהגבהה',      description: 'Push-up with hands on a bench/elevation',        categories: ['calisthenics', 'push', 'chest', 'triceps'],            defaultPhoto: pexels(4162438) },
  { id: 'scap-protraction',           name: 'Scap Protraction',                    hebrewName: 'הרחקת שכמות',              description: 'Scapular push-up — protract shoulder blades',    categories: ['calisthenics', 'push', 'chest', 'shoulders'],          defaultPhoto: pexels(4162438) },
  { id: 'scap-retraction',            name: 'Scap Retraction',                     hebrewName: 'קירוב שכמות',              description: 'Scapular pull — retract shoulder blades',        categories: ['calisthenics', 'pull', 'back', 'shoulders'],           defaultPhoto: pexels(4162451) },
  { id: 'reverse-plank-table',        name: 'Reverse Plank (Table Top)',           hebrewName: 'שולחן הפוך',               description: 'Table-top hold with hips extended',              categories: ['calisthenics', 'full-body', 'abs', 'back'],            defaultPhoto: pexels(4162487) },
  { id: 'downward-dog',               name: 'Downward Dog',                        hebrewName: 'כלב מביט מטה',             description: 'Inverted-V hold for shoulder mobility',          categories: ['calisthenics', 'full-body', 'shoulders'],              defaultPhoto: pexels(4162487) },
  { id: 'hollow-body',                name: 'Hollow Body Hold',                    hebrewName: 'הולואו בודי',              description: 'Supine hollow-position hold',                    categories: ['calisthenics', 'full-body', 'abs'],                    defaultPhoto: pexels(4162487) },
  { id: 'static-row-hold',            name: 'Static Row Hold',                     hebrewName: 'חתירות עם כיווץ סטאטי',    description: 'Inverted row with isometric top-hold',           categories: ['calisthenics', 'pull', 'back'],                        defaultPhoto: pexels(4162485) },
  { id: 'support-knee-raise',         name: 'Knee Raise in Parallel Bar Support',  hebrewName: 'הרמות ברכיים בתמיכה',      description: 'Knee tucks while in parallel bar support',       categories: ['calisthenics', 'abs', 'full-body'],                    defaultPhoto: pexels(4162451) },
  { id: 'scap-depression',            name: 'Scap Depression',                     hebrewName: 'הורדת שכמה',               description: 'Active/passive scapular pull-down on bar',        categories: ['calisthenics', 'back', 'shoulders'],                  defaultPhoto: pexels(4162451) },
  { id: 'plank-pike-half-rotation',   name: 'Plank to Pike Half Rotation',         hebrewName: 'פלאנק לפייק לחצי סיבוב',  description: 'Plank-to-pike flow with half body rotation',     categories: ['calisthenics', 'full-body', 'abs'],                    defaultPhoto: pexels(4162487) },
  { id: 'table-half-rotation',        name: 'Table Top Half Rotation',             hebrewName: 'שולחן הפוך לחצי סיבוב',   description: 'Reverse plank with half body rotation',          categories: ['calisthenics', 'full-body', 'back'],                   defaultPhoto: pexels(4162487) },
  { id: 'static-pull-up',             name: 'Static Pull-Up Hold',                 hebrewName: 'מתח סטאטי',                description: 'Isometric chin-over-bar hold',                   categories: ['calisthenics', 'pull', 'back', 'biceps'],              defaultPhoto: pexels(4162451) },
  { id: 'support-knee-extension',     name: 'Knee Extension in Parallel Bar Support', hebrewName: 'יישורי ברכיים בתמיכה',   description: 'Leg straightening from tuck in support',         categories: ['calisthenics', 'abs', 'quads', 'full-body'],           defaultPhoto: pexels(4162451) },
  { id: 'parallels-assisted',         name: 'Assisted Parallel Bar Dip',           hebrewName: 'מקבילים עם תמיכת רגליים',  description: 'Parallel bar dip with feet supported',           categories: ['calisthenics', 'push', 'chest', 'triceps'],            defaultPhoto: pexels(4162451) },
  { id: 'seated-hip-flexion',         name: 'Seated Hip Flexion',                  hebrewName: 'כפיפת ירך בישיבה',         description: 'Active hip flexion from seated position',        categories: ['calisthenics', 'legs', 'abs'],                         defaultPhoto: pexels(4162487) },
  { id: 'arch-to-tuck-hang',          name: 'Arch to Tuck Hang',                   hebrewName: 'הקשתה לכינוס ברכיים בתליה', description: 'Hanging arch to tuck transition',                categories: ['calisthenics', 'back', 'abs'],                         defaultPhoto: pexels(4162451) },
  { id: 'plank-pike-table',           name: 'Plank / Pike / Table Flow',           hebrewName: 'פלאנק לפייק לשולחן הפוך', description: 'Plank → pike → reverse-plank transition',        categories: ['calisthenics', 'full-body', 'abs'],                    defaultPhoto: pexels(4162487) },
  { id: 'supine-angel-rotation',      name: 'Supine Angel Rotation',               hebrewName: 'רוטציות "מלאך" בשכיבה על הגב', description: 'Snow-angel arm slide on floor',              categories: ['calisthenics', 'back', 'shoulders'],                   defaultPhoto: pexels(4162487) },
  { id: 'negative-dip',               name: 'Negative Parallel Bar Dip',           hebrewName: 'מקבילים שליליים',          description: 'Slow eccentric-only dip on parallel bars',       categories: ['calisthenics', 'push', 'chest', 'triceps'],            defaultPhoto: pexels(4162451) },
  { id: 'negative-pull-up',           name: 'Negative Pull-Up',                    hebrewName: 'מתח שלילי',                description: 'Slow eccentric-only pull-up',                    categories: ['calisthenics', 'pull', 'back', 'biceps'],              defaultPhoto: pexels(4162451) },
  { id: 'straight-leg-raise-support', name: 'Straight Leg Raise in Support',       hebrewName: 'הרמות רגליים ישרות בתמיכה', description: 'Straight-leg raise in parallel bar support',     categories: ['calisthenics', 'abs', 'full-body'],                    defaultPhoto: pexels(4162451) },
  { id: 'wide-row-rear-delt',         name: 'Wide Row (Rear Delt)',                hebrewName: 'חתירות רחבות לכתף אחורית', description: 'Wide-grip inverted row for rear delts',          categories: ['calisthenics', 'pull', 'back', 'shoulders'],           defaultPhoto: pexels(4162485) },
  { id: 'torso-extension',            name: 'Torso Extension',                     hebrewName: 'פשיטות גו',                description: 'Prone back extension',                           categories: ['calisthenics', 'back'],                                defaultPhoto: pexels(4162487) },
  { id: 'l-sit-sequence',             name: 'L-Sit Sequence',                      hebrewName: 'רצף אל סיט',               description: 'Transitions between L-sit positions',            categories: ['calisthenics', 'full-body', 'abs'],                    defaultPhoto: pexels(4162451) },
  { id: 'push-up-to-down-dog',        name: 'Push-Up to Down Dog',                 hebrewName: 'שכיבות סמיכה לכלב מביט מטה', description: 'Push-up into downward dog flow',                categories: ['calisthenics', 'full-body', 'push', 'shoulders'],      defaultPhoto: pexels(4162438) },
  { id: 'hanging-knee-raise-v3',      name: 'Hanging Knee Raise (V3)',             hebrewName: 'הרמות ברכיים בתליה וריאציה 3', description: 'Advanced hanging knee raise variation',       categories: ['calisthenics', 'abs', 'full-body'],                    defaultPhoto: pexels(4162451) },
  { id: 'german-hang-assisted',       name: 'Assisted German Hang',                hebrewName: 'תליה גרמנית',              description: 'German hang with feet on floor for assistance',  categories: ['calisthenics', 'back', 'shoulders', 'full-body'],      defaultPhoto: pexels(4162451) },

  // =====================
  // ATLAS CALISTHENICS — LOWER BODY
  // Single-leg work, mobility, athletic drills, and plyometrics from the Atlas program
  // =====================
  { id: 'step-down',                  name: 'Step Down',                           hebrewName: 'סטפ דאון',                 description: 'Lower body down from a step on one leg',         categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'deep-squat-bw',              name: 'Deep Bodyweight Squat',               hebrewName: 'סקוואט עמוק',              description: 'Full-depth bodyweight squat',                    categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'step-up',                    name: 'Step Up',                             hebrewName: 'עליית מדרגה',              description: 'Bodyweight step up onto box/bench',              categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'seated-90-90',               name: '90-90 Seated Hip Mobility',           hebrewName: '90-90 בישיבה',             description: '90-90 hip rotation drill on floor',              categories: ['calisthenics', 'legs', 'glutes'],                      defaultPhoto: pexels(4162487) },
  { id: 'sumo-seated-forward-lean',   name: 'Sumo Seated Forward Lean',            hebrewName: 'הטיות לפנים בישיבת סומו',  description: 'Seated wide-stance forward lean',                categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'single-leg-stance',          name: 'Single Leg Stance',                   hebrewName: 'עמידה על רגל',             description: 'Balance hold on one leg',                        categories: ['calisthenics', 'legs', 'abs'],                         defaultPhoto: pexels(4162451) },
  { id: 'free-jumps',                 name: 'Free Jumps',                          hebrewName: 'קפיצות משוחררות',          description: 'Unstructured warm-up jumping in place',          categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'coordination-jump',          name: 'Coordination Jump',                   hebrewName: 'קפיצת קואורדינציה',        description: 'Arms-and-legs synced jump',                      categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'single-leg-rdl',             name: 'Single Leg RDL',                      hebrewName: 'דדליפט רומני על רגל אחת', description: 'Single-leg Romanian deadlift (bodyweight)',       categories: ['calisthenics', 'legs', 'hamstrings', 'glutes'],        defaultPhoto: pexels(4162451) },
  { id: 'box-jump',                   name: 'Box Jump',                            hebrewName: 'בוקס ג\'אמפ',              description: 'Explosive jump onto a box',                      categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'deep-squat-hold',            name: 'Deep Squat + Static Hold',            hebrewName: 'סקוואט עמוק + החזקה סטאטית', description: 'Deep squat with pause at the bottom',          categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'figure-4-forward-lean',      name: 'Figure 4 Forward Lean',               hebrewName: 'הטיות לפנים בספרה 4',     description: 'Seated figure-4 glute stretch with lean',        categories: ['calisthenics', 'legs', 'glutes'],                      defaultPhoto: pexels(4162487) },
  { id: 'front-back-jumps',           name: 'Forward-Back Jumps',                  hebrewName: 'קפיצות קדימה אחורה',       description: 'Repeated forward/backward hops',                 categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'elephant-walk',              name: 'Elephant Walk',                       hebrewName: 'הליכת פיל',                description: 'Alternating straight-leg toe touches',           categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'squat-to-pike',              name: 'Squat to Pike',                       hebrewName: 'סקוואט לפייק',             description: 'Squat flowing into standing pike stretch',       categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'heel-sink',                  name: 'Heel Sink',                           hebrewName: 'שקיעות עקב',               description: 'Ankle mobility heel drop',                       categories: ['calisthenics', 'legs', 'calves'],                      defaultPhoto: pexels(4162487) },
  { id: 'single-leg-squat-marker',    name: 'Single Leg Squat (Marker)',           hebrewName: 'סקוואט על רגל אחת עם סמן', description: 'Pistol progression to a marker/target depth',    categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'single-leg-static-squat',    name: 'Single Leg Static Squat',             hebrewName: 'סקוואט סטאטי על רגל אחת', description: 'Isometric hold at bottom of pistol',             categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'low-arc-squat',              name: 'Low Arc Squat',                       hebrewName: 'סקוואט קשתים נמוך',        description: 'Low squat with arcing movement',                 categories: ['calisthenics', 'legs', 'quads'],                       defaultPhoto: pexels(4162451) },
  { id: 'split-squat-elevated-arc',   name: 'Elevated Arc Split Squat',            hebrewName: 'ספליט סקוואט עם הגבהה והקשתה', description: 'Split squat with elevation and arcing motion',  categories: ['calisthenics', 'legs', 'quads', 'glutes'],           defaultPhoto: pexels(4162451) },
  { id: 'knee-to-wall',               name: 'Knee to Wall',                        hebrewName: 'ברך לקיר',                 description: 'Ankle dorsiflexion knee-to-wall drill',          categories: ['calisthenics', 'legs', 'calves'],                      defaultPhoto: pexels(4162487) },
  { id: 'pigeon-pose',                name: 'Pigeon Pose',                         hebrewName: 'מנח יונה',                 description: 'Hip-opener pigeon stretch',                      categories: ['calisthenics', 'legs', 'glutes'],                      defaultPhoto: pexels(4162487) },
  { id: 'pogo-jumps',                 name: 'Pogo Jumps',                          hebrewName: 'קפיצות פוגו',              description: 'Stiff-ankle repeated small bounces',             categories: ['calisthenics', 'legs', 'calves'],                      defaultPhoto: pexels(4162487) },
  { id: 'skater-squat-elevated',      name: 'Elevated Skater Squat',               hebrewName: 'סקייטר סקוואט מהגבהה',     description: 'Skater squat off an elevation',                  categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'sl-static-squat-extension',  name: 'SL Static Squat Knee Extension',      hebrewName: 'יישור ברך בסקוואט סטאטי על רגל אחת', description: 'Knee extension from SL static squat',  categories: ['calisthenics', 'legs', 'quads'],                       defaultPhoto: pexels(4162451) },
  { id: 'explosive-squat-from-sit',   name: 'Explosive Squat from Sit',            hebrewName: 'סקוואט מתפרץ מישיבה',      description: 'Explosive rise from seated position',            categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'arc-squat',                  name: 'Arc Squat',                           hebrewName: 'סקוואט קשתים',             description: 'Squat with arcing side-to-side motion',          categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'split-squat-bw',             name: 'Split Squat',                         hebrewName: 'ספליט סקוואט',             description: 'Bodyweight split squat (rear foot on floor)',    categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'elevated-pistol-squat',      name: 'Elevated Pistol Squat',               hebrewName: 'פיסטול סקוואט בהגבהה',     description: 'Pistol squat off an elevation',                  categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'static-pistol-squat',        name: 'Static Pistol Squat',                 hebrewName: 'פיסטול סקוואט סטאטי',      description: 'Isometric hold at bottom of pistol',             categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'lateral-sl-jump',            name: 'Single Leg Lateral Power Jump',       hebrewName: 'קפיצות כוח צידיות על רגל אחת', description: 'Single-leg explosive lateral jumps',           categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'continuous-squat-jump',      name: 'Continuous Squat Jump',               hebrewName: 'סקוואט קפיצה רציף',        description: 'Repeated squat jumps without pause',             categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'nordic-curl',                name: 'Nordic Hamstring Curl',               hebrewName: 'פשיטת ברכיים נורדית',      description: 'Knee-kneeling eccentric hamstring curl',         categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162451) },
  { id: 'seated-pike-stretch',        name: 'Seated Pike Stretch',                 hebrewName: 'מתיחת פייק בישיבה',        description: 'Seated forward fold for hamstrings',             categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'bear-walk',                  name: 'Bear Walk',                           hebrewName: 'הליכת דוב',                description: 'Quadrupedal forward locomotion',                 categories: ['calisthenics', 'full-body', 'legs'],                   defaultPhoto: pexels(4162487) },
  { id: 'easy-sissy-squat',           name: 'Easy Sissy Squat',                    hebrewName: 'איזי סיסי סקוואט',         description: 'Assisted sissy squat with knee lean-back',       categories: ['calisthenics', 'legs', 'quads'],                       defaultPhoto: pexels(4162451) },
  { id: 'forward-jumps',              name: 'Forward Jumps',                       hebrewName: 'קפיצות לפנים',             description: 'Two-leg broad jumps forward',                    categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'copenhagen-plank',           name: 'Copenhagen Plank',                    hebrewName: 'קופנהגן פלאנק',            description: 'Side plank with top leg on bench (adductor)',    categories: ['calisthenics', 'abs', 'legs'],                         defaultPhoto: pexels(4162487) },
  { id: 'supine-slider-knee-flex',    name: 'Supine Slider Knee Flex',             hebrewName: 'סליידרס כפיפת ברך בשכיבה',description: 'Back-lying slider knee curl',                    categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'standing-knee-extension',    name: 'Standing Knee Extension',             hebrewName: 'יישור ברך בעמידה',         description: 'Standing single-leg knee extension',             categories: ['calisthenics', 'legs', 'quads'],                       defaultPhoto: pexels(4162451) },
  { id: 'sl-heel-sink',               name: 'Single Leg Heel Sink',                hebrewName: 'שקיעות עקב על רגל אחת',    description: 'Single-leg ankle mobility heel drop',            categories: ['calisthenics', 'legs', 'calves'],                      defaultPhoto: pexels(4162487) },
  { id: 'sl-jefferson-curl',          name: 'Single Leg Jefferson Curl',           hebrewName: 'ג\'פרסון קרל על רגל אחת',  description: 'Slow spinal flexion on one leg (weighted opt.)', categories: ['calisthenics', 'legs', 'back', 'hamstrings'],          defaultPhoto: pexels(4162451) },

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

// Merged/renamed exercise IDs → canonical ID they were folded into
const EXERCISE_ID_ALIASES: Record<string, string> = {
  'lat-pulldown': 'wide-grip-lat-pulldown',
};

// Resolve legacy exercise IDs to their canonical counterpart
export function resolveExerciseId(id: string): string {
  return EXERCISE_ID_ALIASES[id] ?? id;
}

// Helper to get exercise by ID (resolves legacy aliases)
export function getExerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISE_LIBRARY.find(e => e.id === resolveExerciseId(id));
}

// Helper to filter exercises by workout type categories
export function filterExercisesByCategories(
  categories: string[]
): ExerciseDefinition[] {
  return EXERCISE_LIBRARY.filter(exercise =>
    exercise.categories.some(cat => categories.includes(cat))
  );
}
