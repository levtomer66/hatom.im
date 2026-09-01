import { ExerciseDefinition } from '@/types/workout';

// Pexels image URL helper
const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400`;

// Muscle & Strength CDN image helper. The compound/forearm exercises
// added from the M&S gap analysis use M&S's own exercise imagery —
// each URL was HEAD-validated (200 + image/*) at authoring time. The
// ExercisePhoto component swaps to the 🏋️ fallback on any future 404,
// so a withdrawn image degrades gracefully rather than showing an
// empty box. CSP allows these (img-src includes https:).
const msImg = (file: string) => `https://cdn.muscleandstrength.com/sites/default/files/${file}`;

export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  // =====================
  // CHEST (Push)
  // =====================
  {
    id: 'low-to-high-cable',
    name: 'Low to High Cable Fly',
    description: 'Upper chest isolation with cables',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(32695897), // Cable machine workout
  },
  {
    id: 'pec-deck',
    name: 'Pec Deck',
    description: 'Chest isolation machine',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(18060022), // Chest machine
  },
  {
    id: 'free-chest-press',
    name: 'Free Chest Press',
    description: 'Dumbbell chest press on bench',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(7187890), // Dumbbell press
  },
  {
    // Promoted from a user-created custom exercise ("לחיצת חזה בכבל")
    // when the custom-exercise feature was retired. Its historical
    // `custom-e609e9b2` id resolves here via EXERCISE_ID_ALIASES.
    id: 'cable-chest-press',
    name: 'Cable Chest Press',
    description: 'Standing/seated chest press on cables',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(5327510), // Cable machine workout
  },
  {
    id: 'high-to-low-cable',
    name: 'High to Low Cable Fly',
    description: 'Lower chest isolation with cables',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(5327510), // Cable machine workout
  },
  {
    id: 'chest-press-machine',
    name: 'Chest Press Machine',
    description: 'Seated machine chest press',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(3888104), // Gym machine
  },
  {
    id: 'incline-chest-machine',
    name: 'Incline Chest Press Machine',
    description: 'Seated incline machine press',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(3837388), // Gym machine
  },
  {
    id: 'bench-press',
    name: 'Bench Press',
    description: 'Barbell flat bench press',
    categories: ['push', 'chest', 'triceps'],
    defaultPhoto: pexels(3837781), // Bench press
  },
  {
    id: 'incline-bench-press',
    name: 'Incline Bench Press',
    description: 'Barbell incline bench press',
    categories: ['push', 'chest', 'triceps'],
    defaultPhoto: pexels(34651540), // Bench press
  },
  {
    id: 'dumbbell-press',
    name: 'Dumbbell Press',
    description: 'Flat dumbbell chest press',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(3838698), // Dumbbell workout
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    description: 'Incline dumbbell chest press',
    categories: ['push', 'chest'],
    defaultPhoto: pexels(18060077), // Dumbbell workout
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
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
    description: 'Cable pushdown with V-bar attachment',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(6243176), // Cable pushdown
  },
  {
    id: 'overhead-rope-press',
    name: 'Overhead Rope Extension',
    description: 'Cable tricep extension overhead',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(14623619), // Cable workout
  },
  {
    id: 'one-hand-cable-pushdown',
    name: 'One Hand Cable Pushdown',
    description: 'Single-arm cable tricep pushdown',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(4164766), // Cable workout
  },
  {
    id: 'medial-one-arm-pull',
    name: 'Medial One Arm Pull',
    description: 'Single-arm tricep medial head focus',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(4164766), // Cable workout
  },
  {
    id: 'tricep-pushdown',
    name: 'Rope Pushdown',
    description: 'Cable pushdown with rope attachment',
    categories: ['push', 'triceps'],
    defaultPhoto: pexels(29218854), // Cable pushdown
  },
  {
    id: 'skull-crusher',
    name: 'Skull Crusher',
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
    description: 'Side delt cable raise (low to 110°)',
    categories: ['push', 'shoulders'],
    defaultPhoto: pexels(3837757), // Cable workout
  },
  {
    id: 'dumbbell-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    description: 'Free-weight side delt raise',
    categories: ['push', 'shoulders'],
    defaultPhoto: pexels(3838389), // Dumbbell shoulder workout
  },
  {
    id: 'machine-shoulder-press',
    name: 'Shoulder Press Machine',
    description: 'Seated machine shoulder press',
    categories: ['push', 'shoulders', 'triceps'],
    defaultPhoto: pexels(4164761), // Machine press
  },
  {
    id: 'overhead-press',
    name: 'Dumbbell Overhead Press',
    description: 'Seated or standing dumbbell press',
    categories: ['push', 'shoulders', 'triceps'],
    defaultPhoto: pexels(3837781), // Shoulder press
  },
  {
    id: 'front-raise',
    name: 'Single-Arm Front Raise',
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
    description: 'Wide grip cable pulldown for lats',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Lat pulldown
  },
  {
    id: 'close-grip-lat-pulldown',
    name: 'Narrow Grip Lat Pull Down',
    description: 'Narrow grip cable pulldown for lats',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Lat pulldown
  },
  {
    id: 'v-bar-pull-belly',
    name: 'V-Bar Pull to Belly',
    description: 'Seated cable row with V-bar',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Cable row
  },
  {
    id: 'wide-pull-belly',
    name: 'Wide Bar Pull to Belly',
    description: 'Seated wide grip cable row',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Cable row
  },
  {
    id: 'single-arm-lat-pullover',
    name: 'Single Arm Lat Pullover',
    description: 'Cable lat pullover single arm',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4164587), // Lat workout
  },
  {
    id: 'dumbell-pullover',
    name: 'Dumbell Pullover',
    description: 'Dumbell pullover',
    categories: ['pull', 'back', 'chest'],
    defaultPhoto: pexels(4162438), // Dumbell workout
  },
  {
    id: 'reverse-pec-deck',
    name: 'Reverse Pec Deck',
    description: 'Rear delt machine fly',
    categories: ['pull', 'back', 'shoulders'],
    defaultPhoto: pexels(4162579), // Back machine
  },
  {
    id: 'face-pull',
    name: 'Face Pull',
    description: 'Cable face pull for rear delts',
    categories: ['pull', 'back', 'shoulders'],
    defaultPhoto: pexels(4164766), // Cable face pull
  },
  {
    id: 'dumbbell-row',
    name: 'Dumbbell Row',
    description: 'Single-arm dumbbell row',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4162438), // Dumbbell row
  },
  {
    id: 'shrug',
    name: 'Shrug',
    description: 'Barbell or dumbbell trap shrug',
    categories: ['pull', 'back'],
    defaultPhoto: pexels(4162579), // Shrug
  },
  {
    id: 'trap-row-machine',
    name: 'Trap Row Machine',
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
    description: 'Cable curl with arm behind body',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4164766), // Cable curl
  },
  {
    id: 'double-arm-bayesian-curl',
    name: 'Double-Arm Bayesian Curl',
    description: 'Cable curl with both arms behind body',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4164766), // Cable curl
  },
  {
    id: 'barbell-curl',
    name: 'Barbell Curl',
    description: 'Standing barbell/EZ-bar biceps curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4164761), // Barbell curl
  },
  {
    id: 'bicep-dumbbell-curl',
    name: 'Single-Arm Dumbbell Curl',
    description: 'Standing alternating dumbbell curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162438), // Dumbbell curl
  },
  {
    id: 'double-arm-bicep-dumbbell-curl',
    name: 'Double-Arm Dumbbell Curl',
    description: 'Standing alternating dumbbell curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162438), // Dumbbell curl
  },
  {
    id: 'biceps-preacher-curl',
    name: 'Preacher Curl',
    description: 'Preacher bench bicep curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162500), // Preacher curl
  },
  {
    id: 'seated-single-arm-preacher-curl',
    name: 'Seated Single-Arm Preacher Curl',
    description: 'Single-arm preacher machine curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162500), // Preacher curl
  },
  {
    id: 'seated-double-arm-preacher-curl',
    name: 'Seated Double-Arm Preacher Curl',
    description: 'Double-arm preacher machine curl',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162500), // Preacher curl
  },
  {
    id: 'seated-dumbbell-curl',
    name: 'Seated Dumbbell Curl',
    description: 'Incline seated curl (short head focus)',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4162438), // Seated curl
  },
  {
    id: 'brachialis-rope-curl',
    name: 'Brachialis Rope Curl',
    description: 'Rope hammer curl for brachialis',
    categories: ['pull', 'biceps'],
    defaultPhoto: pexels(4164766), // Rope curl
  },
  {
    id: 'hammer-curl',
    name: 'Hammer Curl',
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
    description: 'Calf raises using leg press machine',
    categories: ['legs', 'calves'],
    defaultPhoto: pexels(4164512), // Leg press
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension Machine',
    description: 'Seated quad extension',
    categories: ['legs', 'quads'],
    defaultPhoto: pexels(4164512), // Leg machine
  },
  {
    id: 'glute-kick',
    name: 'Glute Kick',
    description: 'Machine or cable glute kickback',
    categories: ['legs', 'glutes'],
    defaultPhoto: pexels(4164512), // Glute workout
  },
  {
    id: 'leg-press',
    name: 'Leg Press Machine',
    description: 'Seated leg press for quads/glutes',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4164512), // Leg press
  },
  {
    id: 'leg-curl',
    name: 'Leg Curl Machine',
    description: 'Seated hamstring curl',
    categories: ['legs', 'hamstrings'],
    defaultPhoto: pexels(4164512), // Leg curl
  },
  {
    id: 'prone-leg-curl',
    name: 'Prone Leg Curl Machine',
    description: 'Lying hamstring curl',
    categories: ['legs', 'hamstrings'],
    defaultPhoto: pexels(4164512), // Leg curl
  },
  {
    id: 'hip-abductors',
    name: 'Hip Abductors Machine',
    description: 'Outer thigh abduction machine',
    categories: ['legs', 'glutes'],
    defaultPhoto: pexels(4164512), // Hip machine
  },
  {
    // Was previously the id `hip-flexors` mislabeled "Hip Adductors
    // Machine". Renamed to a correct `adductors` id; the old id folds
    // into this one via EXERCISE_ID_ALIASES so the 5 historical
    // workouts logged under `hip-flexors` (which were inner-thigh
    // adduction work per the old name) keep resolving here.
    id: 'adductors',
    name: 'Adductors Machine',
    description: 'Inner thigh adduction machine',
    categories: ['legs', 'glutes'],
    defaultPhoto: pexels(4164512), // Hip machine
  },
  {
    id: 'hip-thrust',
    name: 'Hip Thrust Machine',
    description: 'Glute-focused hip thrust',
    categories: ['legs', 'glutes'],
    defaultPhoto: pexels(4162451), // Hip thrust
  },
  {
    id: 'squat',
    name: 'Squat',
    description: 'Barbell back squat',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4164766), // Squat
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    description: 'Stiff-leg deadlift for hamstrings',
    categories: ['legs', 'hamstrings', 'glutes'],
    defaultPhoto: pexels(1552252), // Deadlift
  },
  {
    id: 'cable-romanian-deadlift',
    name: 'Cable Romanian Deadlift',
    description: 'Cable RDL for hamstrings',
    categories: ['legs', 'hamstrings', 'glutes'],
    defaultPhoto: pexels(1552252), // Deadlift
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    description: 'Conventional barbell deadlift',
    categories: ['legs', 'full-body', 'back', 'hamstrings', 'glutes'],
    defaultPhoto: pexels(1552252), // Deadlift barbell
  },
  {
    id: 'lunge',
    name: 'Lunge',
    description: 'Walking or stationary lunge',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4162451), // Lunge
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    description: 'Rear-foot elevated split squat',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4162451), // Split squat
  },
  {
    id: 'calf-raise',
    name: 'Standing Calf Raise',
    description: 'Standing calf raise machine',
    categories: ['legs', 'calves'],
    defaultPhoto: pexels(4164512), // Calf raise
  },
  {
    id: 'hack-squat',
    name: 'Hack Squat',
    description: 'Hack squat machine',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4164512), // Hack squat
  },
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    description: 'Dumbbell front-loaded squat',
    categories: ['legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4162438), // Goblet squat
  },
  {
    id: 'sumo-deadlift',
    name: 'Sumo Deadlift',
    description: 'Wide stance barbell deadlift',
    categories: ['legs', 'full-body', 'glutes', 'hamstrings', 'back'],
    defaultPhoto: pexels(1552252), // Sumo deadlift
  },
  {
    id: 'glute-kickback',
    name: 'Glute Kickback',
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
    description: 'Seated ab crunch machine',
    categories: ['full-body', 'abs'],
    defaultPhoto: pexels(4162487), // Abs workout
  },
  {
    id: 'ab-cable-crunch',
    name: 'Abdominal Cable Crunch',
    description: 'Kneeling cable ab crunch',
    categories: ['full-body', 'abs'],
    defaultPhoto: pexels(4162487), // Cable crunch
  },
  {
    id: 'ab-wheel',
    name: 'Ab Wheel',
    description: 'Ab wheel rollout',
    categories: ['full-body', 'calisthenics', 'abs'],
    defaultPhoto: pexels(4162487), // Ab wheel
  },
  {
    id: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    description: 'Hanging knee or leg raise',
    categories: ['calisthenics', 'full-body', 'abs'],
    defaultPhoto: pexels(4162451), // Hanging leg raise
  },
  {
    id: 'plank',
    name: 'Plank',
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
    description: 'Overhand grip pull-up',
    categories: ['calisthenics', 'pull', 'back', 'biceps'],
    defaultPhoto: pexels(4162451), // Pull-up bar
  },
  {
    id: 'pull-up-machine',
    name: 'Pull-Up Machine',
    description: 'Machine pull-up',
    categories: ['calisthenics', 'pull', 'back'],
    defaultPhoto: pexels(4162451), // Pull-up machine
  },
  {
    id: 'parallels',
    name: 'Parallel Bars Dip',
    description: 'Bodyweight parallel bar dip',
    categories: ['calisthenics', 'push', 'chest', 'triceps'],
    defaultPhoto: pexels(4162451), // Parallel bars
  },
  {
    id: 'weighted-parallels',
    name: 'Weighted Parallel Bars Dip',
    description: 'Weighted parallel bar dip',
    categories: ['calisthenics', 'push', 'chest', 'triceps'],
    defaultPhoto: pexels(4162451), // Weighted dip
  },
  {
    id: 'chin-up',
    name: 'Chin-Up',
    description: 'Underhand grip chin-up',
    categories: ['calisthenics', 'pull', 'back', 'biceps'],
    defaultPhoto: pexels(4162451), // Chin-up
  },
  {
    id: 'push-up',
    name: 'Push-Up',
    description: 'Bodyweight push-up',
    categories: ['calisthenics', 'push', 'chest', 'triceps'],
    defaultPhoto: pexels(4162438), // Push-up
  },
  {
    id: 'dip',
    name: 'Bench Dips',
    description: 'Tricep dips on bench',
    categories: ['calisthenics', 'push', 'triceps'],
    defaultPhoto: pexels(4162451), // Dip
  },
  {
    id: 'muscle-up',
    name: 'Muscle-Up',
    description: 'Bar or ring muscle-up',
    categories: ['calisthenics', 'full-body', 'back', 'chest', 'triceps'],
    defaultPhoto: pexels(4162451), // Muscle-up
  },
  {
    id: 'pistol-squat',
    name: 'Pistol Squat',
    description: 'Single-leg bodyweight squat',
    categories: ['calisthenics', 'legs', 'quads', 'glutes'],
    defaultPhoto: pexels(4162451), // Pistol squat
    progression: [
      { id: 'assisted', name: 'Assisted Pistol', measure: 'reps', cue: 'Hold a post/TRX for balance', advanceAt: { value: 8, sets: 3 } },
      { id: 'box',      name: 'Box Pistol',      measure: 'reps', cue: 'Sit to a box, stand on one leg', advanceAt: { value: 6, sets: 3 } },
      { id: 'full',     name: 'Full Pistol Squat', measure: 'reps', cue: 'Full depth, no support' },
    ],
  },
  {
    id: 'inverted-row',
    name: 'Inverted Row',
    description: 'Bodyweight horizontal row',
    categories: ['calisthenics', 'pull', 'back'],
    defaultPhoto: pexels(4162485), // Inverted row
  },
  {
    id: 'l-sit',
    name: 'L-Sit',
    description: 'Isometric L-sit hold',
    categories: ['calisthenics', 'full-body', 'abs'],
    defaultPhoto: pexels(4162451), // L-sit
    progression: [
      { id: 'tuck-sit', name: 'Tuck Sit',      measure: 'seconds', cue: 'Knees tucked, hips off the floor', advanceAt: { value: 20, sets: 3 } },
      { id: 'one-leg',  name: 'One-Leg L-Sit', measure: 'seconds', cue: 'One leg extended, one tucked',     advanceAt: { value: 15, sets: 3 } },
      { id: 'l-sit',    name: 'L-Sit',         measure: 'seconds', cue: 'Both legs straight, parallel to floor', advanceAt: { value: 10, sets: 3 } },
      { id: 'v-sit',    name: 'V-Sit',         measure: 'seconds', cue: 'Legs raised above hip height' },
    ],
  },

  // =====================
  // CALISTHENICS SKILLS (Planche / Front Lever / Handstand / Muscle-Up)
  // Skill-progression work — added for the Hybrid Calisthenics + Hypertrophy program.
  // =====================
  {
    id: 'handstand-hspu-progression', name: 'HSPU Progression',
    description: 'Vertical pressing strength: pike push-up → wall HSPU → freestanding HSPU',
    categories: ['calisthenics', 'push', 'shoulders'], defaultPhoto: pexels(4162451),
    progression: [
      { id: 'pike',              name: 'Pike Push-Up',          measure: 'reps', cue: 'Hips high, press through the top of your head', advanceAt: { value: 10, sets: 3 } },
      { id: 'elevated-pike',     name: 'Elevated Pike Push-Up', measure: 'reps', cue: 'Feet on a box for a steeper angle',            advanceAt: { value: 8, sets: 3 } },
      { id: 'wall-hspu',         name: 'Wall HSPU',             measure: 'reps', cue: 'Chest-to-wall handstand, full ROM',           advanceAt: { value: 5, sets: 3 } },
      { id: 'freestanding-hspu', name: 'Freestanding HSPU',     measure: 'reps', cue: 'No wall — balance and press' },
    ],
  },
  {
    id: 'handstand-progression', name: 'Handstand Progression',
    description: 'Balance ladder: back-to-wall → chest-to-wall → freestanding hold',
    categories: ['calisthenics', 'push', 'shoulders'], defaultPhoto: pexels(4162451),
    progression: [
      { id: 'wall-back',    name: 'Back-to-Wall Handstand',  measure: 'seconds', cue: 'Belly to wall, stack shoulders over hands', advanceAt: { value: 45, sets: 3 } },
      { id: 'wall-chest',   name: 'Chest-to-Wall Handstand', measure: 'seconds', cue: 'Face the wall, tight line',                 advanceAt: { value: 45, sets: 3 } },
      { id: 'freestanding', name: 'Freestanding Handstand',  measure: 'seconds', cue: 'Kick up and balance, no wall' },
    ],
  },
  {
    id: 'planche-progression', name: 'Planche Progression',
    description: 'Tuck → advanced tuck → straddle → full planche hold',
    categories: ['calisthenics', 'push', 'shoulders', 'abs'], defaultPhoto: pexels(4162451),
    progression: [
      { id: 'tuck',     name: 'Tuck Planche',     measure: 'seconds', cue: 'Knees to chest, lean forward, hips at shoulder height', advanceAt: { value: 20, sets: 3 } },
      { id: 'adv-tuck', name: 'Advanced Tuck Planche', measure: 'seconds', cue: 'Open the knees, flatten the back', advanceAt: { value: 15, sets: 3 } },
      { id: 'straddle', name: 'Straddle Planche', measure: 'seconds', cue: 'Legs wide and straight', advanceAt: { value: 10, sets: 3 } },
      { id: 'full',     name: 'Full Planche',     measure: 'seconds', cue: 'Legs together, straight, parallel to floor' },
    ],
  },
  { id: 'push-up-progression',         name: 'Push-Up Progression',                       description: 'Progressive push-up variation (ring/archer path toward a one-arm push-up)',    categories: ['calisthenics', 'push', 'chest', 'triceps'],   defaultPhoto: pexels(4162438) },
  {
    id: 'front-lever-progression', name: 'Front Lever Progression',
    description: 'Tuck → advanced tuck → straddle → full front lever hold',
    categories: ['calisthenics', 'pull', 'back', 'abs'], defaultPhoto: pexels(4162451),
    progression: [
      { id: 'tuck',     name: 'Tuck Front Lever',     measure: 'seconds', cue: 'Knees tucked, body horizontal, arms straight', advanceAt: { value: 20, sets: 3 } },
      { id: 'adv-tuck', name: 'Advanced Tuck Front Lever', measure: 'seconds', cue: 'Open the hips, flat back', advanceAt: { value: 15, sets: 3 } },
      { id: 'straddle', name: 'Straddle Front Lever', measure: 'seconds', cue: 'Legs wide and straight', advanceAt: { value: 10, sets: 3 } },
      { id: 'full',     name: 'Full Front Lever',     measure: 'seconds', cue: 'Legs together, whole body horizontal' },
    ],
  },
  {
    id: 'front-lever-row', name: 'Front Lever Row',
    description: 'Row performed from a front lever body position',
    categories: ['calisthenics', 'pull', 'back'], defaultPhoto: pexels(4162485),
    progression: [
      { id: 'tuck-row',     name: 'Tuck FL Row',     measure: 'reps', cue: 'Row while holding a tuck lever', advanceAt: { value: 8, sets: 3 } },
      { id: 'straddle-row', name: 'Straddle FL Row', measure: 'reps', cue: 'Row from a straddle lever',      advanceAt: { value: 6, sets: 3 } },
      { id: 'full-row',     name: 'Full FL Row',     measure: 'reps', cue: 'Row from a full front lever' },
    ],
  },
  { id: 'front-lever-pulldown',        name: 'Front-Lever Pulldown',                      description: 'Straight-arm cable pulldown that builds front lever and lat strength',        categories: ['calisthenics', 'pull', 'back'],                defaultPhoto: pexels(4164587) },
  { id: 'weighted-pull-up',            name: 'Weighted Pull-Up',                          description: 'Pull-up with added external load',                                            categories: ['calisthenics', 'pull', 'back', 'biceps'],      defaultPhoto: pexels(4162451) },
  { id: 'explosive-pullup-progression', name: 'Explosive Pull-Ups / Muscle-Up Progression', description: 'Fast, technique-focused pull-ups building toward the muscle-up transition',    categories: ['calisthenics', 'pull', 'back', 'full-body'],  defaultPhoto: pexels(4162451) },
  {
    id: 'muscle-up-progression', name: 'Muscle-Up Progression',
    description: 'False-grip pull-ups, transition drills, and explosive pull-ups toward the muscle-up',
    categories: ['calisthenics', 'pull', 'back', 'full-body'], defaultPhoto: pexels(4162451),
    progression: [
      { id: 'chest-to-bar', name: 'Chest-to-Bar Pull-Up', measure: 'reps', cue: 'Pull until the bar meets your chest', advanceAt: { value: 5, sets: 3 } },
      { id: 'high-pullup',  name: 'High Pull-Up',         measure: 'reps', cue: 'Explode as high as possible, hips to bar', advanceAt: { value: 3, sets: 3 } },
      { id: 'band-mu',      name: 'Banded Muscle-Up',     measure: 'reps', cue: 'Full muscle-up assisted by a band',        advanceAt: { value: 3, sets: 3 } },
      { id: 'muscle-up',    name: 'Muscle-Up',            measure: 'reps', cue: 'Pull, transition, press to support' },
    ],
  },

  // =====================
  // ATLAS CALISTHENICS — UPPER BODY
  // Skill progressions, scap work, holds, and transitions from the Atlas program
  // =====================
  { id: 'active-hang',                name: 'Active Hang',                         description: 'Scap-engaged dead hang on bar',                 categories: ['calisthenics', 'back', 'shoulders'],                  defaultPhoto: pexels(4162451) },
  { id: 'vertical-support',           name: 'Vertical Support',                    description: 'Straight-arm support hold on parallel bars',    categories: ['calisthenics', 'push', 'shoulders', 'triceps'],       defaultPhoto: pexels(4162451) },
  { id: 'elevated-push-up',           name: 'Elevated Push-Up',                    description: 'Push-up with hands on a bench/elevation',        categories: ['calisthenics', 'push', 'chest', 'triceps'],            defaultPhoto: pexels(4162438) },
  { id: 'scap-protraction',           name: 'Scap Protraction',                    description: 'Scapular push-up — protract shoulder blades',    categories: ['calisthenics', 'push', 'chest', 'shoulders'],          defaultPhoto: pexels(4162438) },
  { id: 'scap-retraction',            name: 'Scap Retraction',                     description: 'Scapular pull — retract shoulder blades',        categories: ['calisthenics', 'pull', 'back', 'shoulders'],           defaultPhoto: pexels(4162451) },
  { id: 'reverse-plank-table',        name: 'Reverse Plank (Table Top)',           description: 'Table-top hold with hips extended',              categories: ['calisthenics', 'full-body', 'abs', 'back'],            defaultPhoto: pexels(4162487) },
  { id: 'downward-dog',               name: 'Downward Dog',                        description: 'Inverted-V hold for shoulder mobility',          categories: ['calisthenics', 'full-body', 'shoulders'],              defaultPhoto: pexels(4162487) },
  { id: 'hollow-body',                name: 'Hollow Body Hold',                    description: 'Supine hollow-position hold',                    categories: ['calisthenics', 'full-body', 'abs'],                    defaultPhoto: pexels(4162487) },
  { id: 'static-row-hold',            name: 'Static Row Hold',                     description: 'Inverted row with isometric top-hold',           categories: ['calisthenics', 'pull', 'back'],                        defaultPhoto: pexels(4162485) },
  { id: 'support-knee-raise',         name: 'Knee Raise in Parallel Bar Support',  description: 'Knee tucks while in parallel bar support',       categories: ['calisthenics', 'abs', 'full-body'],                    defaultPhoto: pexels(4162451) },
  { id: 'scap-depression',            name: 'Scap Depression',                     description: 'Active/passive scapular pull-down on bar',        categories: ['calisthenics', 'back', 'shoulders'],                  defaultPhoto: pexels(4162451) },
  { id: 'plank-pike-half-rotation',   name: 'Plank to Pike Half Rotation',         description: 'Plank-to-pike flow with half body rotation',     categories: ['calisthenics', 'full-body', 'abs'],                    defaultPhoto: pexels(4162487) },
  { id: 'table-half-rotation',        name: 'Table Top Half Rotation',             description: 'Reverse plank with half body rotation',          categories: ['calisthenics', 'full-body', 'back'],                   defaultPhoto: pexels(4162487) },
  { id: 'static-pull-up',             name: 'Static Pull-Up Hold',                 description: 'Isometric chin-over-bar hold',                   categories: ['calisthenics', 'pull', 'back', 'biceps'],              defaultPhoto: pexels(4162451) },
  { id: 'support-knee-extension',     name: 'Knee Extension in Parallel Bar Support', description: 'Leg straightening from tuck in support',         categories: ['calisthenics', 'abs', 'quads', 'full-body'],           defaultPhoto: pexels(4162451) },
  { id: 'parallels-assisted',         name: 'Assisted Parallel Bar Dip',           description: 'Parallel bar dip with feet supported',           categories: ['calisthenics', 'push', 'chest', 'triceps'],            defaultPhoto: pexels(4162451) },
  { id: 'seated-hip-flexion',         name: 'Seated Hip Flexion',                  description: 'Active hip flexion from seated position',        categories: ['calisthenics', 'legs', 'abs'],                         defaultPhoto: pexels(4162487) },
  { id: 'arch-to-tuck-hang',          name: 'Arch to Tuck Hang',                   description: 'Hanging arch to tuck transition',                categories: ['calisthenics', 'back', 'abs'],                         defaultPhoto: pexels(4162451) },
  { id: 'plank-pike-table',           name: 'Plank / Pike / Table Flow',           description: 'Plank → pike → reverse-plank transition',        categories: ['calisthenics', 'full-body', 'abs'],                    defaultPhoto: pexels(4162487) },
  { id: 'supine-angel-rotation',      name: 'Supine Angel Rotation',               description: 'Snow-angel arm slide on floor',              categories: ['calisthenics', 'back', 'shoulders'],                   defaultPhoto: pexels(4162487) },
  { id: 'negative-dip',               name: 'Negative Parallel Bar Dip',           description: 'Slow eccentric-only dip on parallel bars',       categories: ['calisthenics', 'push', 'chest', 'triceps'],            defaultPhoto: pexels(4162451) },
  { id: 'negative-pull-up',           name: 'Negative Pull-Up',                    description: 'Slow eccentric-only pull-up',                    categories: ['calisthenics', 'pull', 'back', 'biceps'],              defaultPhoto: pexels(4162451) },
  { id: 'straight-leg-raise-support', name: 'Straight Leg Raise in Support',       description: 'Straight-leg raise in parallel bar support',     categories: ['calisthenics', 'abs', 'full-body'],                    defaultPhoto: pexels(4162451) },
  { id: 'wide-row-rear-delt',         name: 'Wide Row (Rear Delt)',                description: 'Wide-grip inverted row for rear delts',          categories: ['calisthenics', 'pull', 'back', 'shoulders'],           defaultPhoto: pexels(4162485) },
  { id: 'torso-extension',            name: 'Torso Extension',                     description: 'Prone back extension',                           categories: ['calisthenics', 'back'],                                defaultPhoto: pexels(4162487) },
  { id: 'l-sit-sequence',             name: 'L-Sit Sequence',                      description: 'Transitions between L-sit positions',            categories: ['calisthenics', 'full-body', 'abs'],                    defaultPhoto: pexels(4162451) },
  { id: 'push-up-to-down-dog',        name: 'Push-Up to Down Dog',                 description: 'Push-up into downward dog flow',                categories: ['calisthenics', 'full-body', 'push', 'shoulders'],      defaultPhoto: pexels(4162438) },
  { id: 'hanging-knee-raise-v3',      name: 'Hanging Knee Raise (V3)',             description: 'Advanced hanging knee raise variation',       categories: ['calisthenics', 'abs', 'full-body'],                    defaultPhoto: pexels(4162451) },
  { id: 'german-hang-assisted',       name: 'Assisted German Hang',                description: 'German hang with feet on floor for assistance',  categories: ['calisthenics', 'back', 'shoulders', 'full-body'],      defaultPhoto: pexels(4162451) },

  // =====================
  // ATLAS CALISTHENICS — LOWER BODY
  // Single-leg work, mobility, athletic drills, and plyometrics from the Atlas program
  // =====================
  { id: 'step-down',                  name: 'Step Down',                           description: 'Lower body down from a step on one leg',         categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'deep-squat-bw',              name: 'Deep Bodyweight Squat',               description: 'Full-depth bodyweight squat',                    categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'step-up',                    name: 'Step Up',                             description: 'Bodyweight step up onto box/bench',              categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'seated-90-90',               name: '90-90 Seated Hip Mobility',           description: '90-90 hip rotation drill on floor',              categories: ['calisthenics', 'legs', 'glutes'],                      defaultPhoto: pexels(4162487) },
  { id: 'sumo-seated-forward-lean',   name: 'Sumo Seated Forward Lean',            description: 'Seated wide-stance forward lean',                categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'single-leg-stance',          name: 'Single Leg Stance',                   description: 'Balance hold on one leg',                        categories: ['calisthenics', 'legs', 'abs'],                         defaultPhoto: pexels(4162451) },
  { id: 'free-jumps',                 name: 'Free Jumps',                          description: 'Unstructured warm-up jumping in place',          categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'coordination-jump',          name: 'Coordination Jump',                   description: 'Arms-and-legs synced jump',                      categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'single-leg-rdl',             name: 'Single Leg RDL',                      description: 'Single-leg Romanian deadlift (bodyweight)',       categories: ['calisthenics', 'legs', 'hamstrings', 'glutes'],        defaultPhoto: pexels(4162451) },
  { id: 'box-jump',                   name: 'Box Jump',                            description: 'Explosive jump onto a box',                      categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'deep-squat-hold',            name: 'Deep Squat + Static Hold',            description: 'Deep squat with pause at the bottom',          categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'figure-4-forward-lean',      name: 'Figure 4 Forward Lean',               description: 'Seated figure-4 glute stretch with lean',        categories: ['calisthenics', 'legs', 'glutes'],                      defaultPhoto: pexels(4162487) },
  { id: 'front-back-jumps',           name: 'Forward-Back Jumps',                  description: 'Repeated forward/backward hops',                 categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'elephant-walk',              name: 'Elephant Walk',                       description: 'Alternating straight-leg toe touches',           categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'squat-to-pike',              name: 'Squat to Pike',                       description: 'Squat flowing into standing pike stretch',       categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'heel-sink',                  name: 'Heel Sink',                           description: 'Ankle mobility heel drop',                       categories: ['calisthenics', 'legs', 'calves'],                      defaultPhoto: pexels(4162487) },
  { id: 'single-leg-squat-marker',    name: 'Single Leg Squat (Marker)',           description: 'Pistol progression to a marker/target depth',    categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'single-leg-static-squat',    name: 'Single Leg Static Squat',             description: 'Isometric hold at bottom of pistol',             categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'low-arc-squat',              name: 'Low Arc Squat',                       description: 'Low squat with arcing movement',                 categories: ['calisthenics', 'legs', 'quads'],                       defaultPhoto: pexels(4162451) },
  { id: 'split-squat-elevated-arc',   name: 'Elevated Arc Split Squat',            description: 'Split squat with elevation and arcing motion',  categories: ['calisthenics', 'legs', 'quads', 'glutes'],           defaultPhoto: pexels(4162451) },
  { id: 'knee-to-wall',               name: 'Knee to Wall',                        description: 'Ankle dorsiflexion knee-to-wall drill',          categories: ['calisthenics', 'legs', 'calves'],                      defaultPhoto: pexels(4162487) },
  { id: 'pigeon-pose',                name: 'Pigeon Pose',                         description: 'Hip-opener pigeon stretch',                      categories: ['calisthenics', 'legs', 'glutes'],                      defaultPhoto: pexels(4162487) },
  { id: 'pogo-jumps',                 name: 'Pogo Jumps',                          description: 'Stiff-ankle repeated small bounces',             categories: ['calisthenics', 'legs', 'calves'],                      defaultPhoto: pexels(4162487) },
  { id: 'skater-squat-elevated',      name: 'Elevated Skater Squat',               description: 'Skater squat off an elevation',                  categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'sl-static-squat-extension',  name: 'SL Static Squat Knee Extension',      description: 'Knee extension from SL static squat',  categories: ['calisthenics', 'legs', 'quads'],                       defaultPhoto: pexels(4162451) },
  { id: 'explosive-squat-from-sit',   name: 'Explosive Squat from Sit',            description: 'Explosive rise from seated position',            categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'arc-squat',                  name: 'Arc Squat',                           description: 'Squat with arcing side-to-side motion',          categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'split-squat-bw',             name: 'Split Squat',                         description: 'Bodyweight split squat (rear foot on floor)',    categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'elevated-pistol-squat',      name: 'Elevated Pistol Squat',               description: 'Pistol squat off an elevation',                  categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'static-pistol-squat',        name: 'Static Pistol Squat',                 description: 'Isometric hold at bottom of pistol',             categories: ['calisthenics', 'legs', 'quads', 'glutes'],             defaultPhoto: pexels(4162451) },
  { id: 'lateral-sl-jump',            name: 'Single Leg Lateral Power Jump',       description: 'Single-leg explosive lateral jumps',           categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'continuous-squat-jump',      name: 'Continuous Squat Jump',               description: 'Repeated squat jumps without pause',             categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'nordic-curl',                name: 'Nordic Hamstring Curl',               description: 'Knee-kneeling eccentric hamstring curl',         categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162451) },
  { id: 'seated-pike-stretch',        name: 'Seated Pike Stretch',                 description: 'Seated forward fold for hamstrings',             categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'bear-walk',                  name: 'Bear Walk',                           description: 'Quadrupedal forward locomotion',                 categories: ['calisthenics', 'full-body', 'legs'],                   defaultPhoto: pexels(4162487) },
  { id: 'easy-sissy-squat',           name: 'Easy Sissy Squat',                    description: 'Assisted sissy squat with knee lean-back',       categories: ['calisthenics', 'legs', 'quads'],                       defaultPhoto: pexels(4162451) },
  { id: 'forward-jumps',              name: 'Forward Jumps',                       description: 'Two-leg broad jumps forward',                    categories: ['calisthenics', 'legs', 'full-body'],                   defaultPhoto: pexels(4162487) },
  { id: 'copenhagen-plank',           name: 'Copenhagen Plank',                    description: 'Side plank with top leg on bench (adductor)',    categories: ['calisthenics', 'abs', 'legs'],                         defaultPhoto: pexels(4162487) },
  { id: 'supine-slider-knee-flex',    name: 'Supine Slider Knee Flex',             description: 'Back-lying slider knee curl',                    categories: ['calisthenics', 'legs', 'hamstrings'],                  defaultPhoto: pexels(4162487) },
  { id: 'standing-knee-extension',    name: 'Standing Knee Extension',             description: 'Standing single-leg knee extension',             categories: ['calisthenics', 'legs', 'quads'],                       defaultPhoto: pexels(4162451) },
  { id: 'sl-heel-sink',               name: 'Single Leg Heel Sink',                description: 'Single-leg ankle mobility heel drop',            categories: ['calisthenics', 'legs', 'calves'],                      defaultPhoto: pexels(4162487) },
  { id: 'sl-jefferson-curl',          name: 'Single Leg Jefferson Curl',           description: 'Slow spinal flexion on one leg (weighted opt.)', categories: ['calisthenics', 'legs', 'back', 'hamstrings'],          defaultPhoto: pexels(4162451) },

  // =====================
  // FULL BODY (remaining ideas — clean-and-press / farmers-walk /
  // upright-row are now live in the COMPOUNDS section below)
  // =====================
  // {
  //   id: 'thruster',
  //   name: 'Thruster',
  //   categories: ['full-body'],
  // },
  // {
  //   id: 'burpee',
  //   name: 'Burpee',
  //   categories: ['full-body', 'calisthenics'],
  // },
  // {
  //   id: 'kettlebell-swing',
  //   name: 'Kettlebell Swing',
  //   categories: ['full-body'],
  // },

  // =====================
  // COMPOUNDS (added from the Muscle & Strength gap analysis)
  // defaultPhoto URLs are M&S CDN images, each HEAD-validated at
  // authoring time; ExercisePhoto falls back to 🏋️ on any future 404.
  // clean-and-press has no M&S still image (video-only page), so it
  // intentionally has no defaultPhoto and uses the fallback.
  // =====================
  { id: 'bent-over-row',        name: 'Barbell Bent-Over Row',  description: 'Barbell row hinged at the hips',          categories: ['pull', 'back'],                 defaultPhoto: msImg('t-bar-row.jpg') },
  { id: 't-bar-row',            name: 'T-Bar Row',              description: 'Landmine / T-bar back row',               categories: ['pull', 'back'],                 defaultPhoto: msImg('machine-t-bar-row.jpg') },
  { id: 'seated-cable-row',     name: 'Seated Cable Row',       description: 'Neutral-grip seated cable row',            categories: ['pull', 'back'],                 defaultPhoto: msImg('seated-cable-row.jpg') },
  { id: 'barbell-pullover',     name: 'Barbell Pullover',       description: 'Lying barbell pullover for lats/chest',    categories: ['pull', 'back', 'chest'],        defaultPhoto: msImg('barbellpullover.jpg') },
  { id: 'upright-row',          name: 'Upright Row',            description: 'Barbell/cable upright row for delts/traps', categories: ['pull', 'shoulders'],           defaultPhoto: msImg('cable-upright-row-1.jpg') },
  { id: 'barbell-hip-thrust',   name: 'Barbell Hip Thrust',     description: 'Bench-supported barbell hip thrust',       categories: ['legs', 'glutes'],               defaultPhoto: msImg('barbell-hip-thrusts.jpg') },
  { id: 'front-squat',          name: 'Front Squat',            description: 'Front-rack barbell squat',                 categories: ['legs', 'quads'],                defaultPhoto: msImg('front-squat-1.jpg') },
  { id: 'good-morning',         name: 'Good Morning',           description: 'Barbell hip hinge for posterior chain',   categories: ['legs', 'hamstrings', 'back'],   defaultPhoto: msImg('standing-good-morning.jpg') },
  { id: 'military-press',       name: 'Military Press',         description: 'Standing barbell overhead press',          categories: ['push', 'shoulders'],           defaultPhoto: msImg('military-overhead-press.jpg') },
  { id: 'push-press',           name: 'Push Press',             description: 'Leg-driven barbell overhead press',        categories: ['push', 'shoulders'],           defaultPhoto: msImg('push-press.jpg') },
  { id: 'arnold-press',         name: 'Arnold Press',           description: 'Rotating dumbbell shoulder press',         categories: ['push', 'shoulders'],           defaultPhoto: msImg('seated-arnold-press-thumb.jpg') },
  { id: 'power-clean',          name: 'Power Clean',            description: 'Explosive barbell pull to front rack',    categories: ['full-body', 'pull'],            defaultPhoto: msImg('power-clean.jpg') },
  { id: 'clean-and-press',      name: 'Clean and Press',        description: 'Barbell clean into overhead press',       categories: ['full-body'] },
  { id: 'snatch',               name: 'Snatch',                 description: 'Explosive barbell ground-to-overhead',    categories: ['full-body'],                    defaultPhoto: msImg('power-snatch.jpg') },
  { id: 'farmers-walk',         name: "Farmer's Walk",          description: 'Loaded carry for grip & whole body',      categories: ['full-body', 'forearms'],        defaultPhoto: msImg('dumbbell-farmers-carry.jpg') },

  // =====================
  // FOREARMS
  // =====================
  { id: 'barbell-wrist-curl',   name: 'Barbell Wrist Curl',     description: 'Seated wrist flexion with a barbell',      categories: ['pull', 'forearms'],            defaultPhoto: msImg('seated-barbell-wrist-curl.jpg') },
  { id: 'dumbbell-wrist-curl',  name: 'Dumbbell Wrist Curl',    description: 'Seated wrist flexion with dumbbells',      categories: ['pull', 'forearms'],            defaultPhoto: msImg('seated-dumbbell-wrist-curl.jpg') },
  { id: 'reverse-wrist-curl',   name: 'Reverse Wrist Curl',     description: 'Wrist extension for forearm extensors',    categories: ['pull', 'forearms'],            defaultPhoto: msImg('reverse_grip_barbell_wrist_curl.jpg') },
];

// Bodyweight-mode exercises → fraction of bodyweight the movement moves, used
// by the volume counter (load = bodyweight × factor + any added kg). Applied to
// the library entries below in one place so the factors are easy to review and
// tune. Values are training-convention estimates; only rep-loggable bodyweight
// STRENGTH movements are listed — anything absent stays 'standard' (adds 0 for
// a null-weight set, exactly as before). Assisted/cable variants are
// deliberately excluded (their entered number isn't added bodyweight load).
const BODYWEIGHT_FACTORS: Record<string, number> = {
  // Pulling — essentially full bodyweight
  'pull-up': 1, 'chin-up': 1, 'muscle-up': 1, 'muscle-up-progression': 1,
  'explosive-pullup-progression': 1, 'weighted-pull-up': 1, 'negative-pull-up': 1,
  // Dips — parallel-bar dips move ~full BW; bench dips much less
  'parallels': 1, 'weighted-parallels': 1, 'negative-dip': 1, 'dip': 0.5,
  // Pushing
  'push-up': 0.65, 'push-up-progression': 0.65, 'elevated-push-up': 0.5,
  'handstand-hspu-progression': 0.7,
  // Horizontal pulls
  'inverted-row': 0.6, 'wide-row-rear-delt': 0.6, 'front-lever-row': 0.6,
  // Legs
  'pistol-squat': 0.85, 'elevated-pistol-squat': 0.85, 'deep-squat-bw': 0.6,
  'split-squat-bw': 0.7, 'step-up': 0.7, 'single-leg-rdl': 0.85, 'nordic-curl': 0.9,
  // Core (rep-based raises)
  'hanging-leg-raise': 0.5, 'hanging-knee-raise-v3': 0.5,
};

for (const ex of EXERCISE_LIBRARY) {
  const factor = BODYWEIGHT_FACTORS[ex.id];
  if (factor != null) {
    ex.loadMode = 'bodyweight';
    ex.bodyweightFactor = factor;
  }
}

// Merged/renamed exercise IDs → canonical ID they were folded into
const EXERCISE_ID_ALIASES: Record<string, string> = {
  'lat-pulldown': 'wide-grip-lat-pulldown',
  // The old `hip-flexors` id was a misnomer — its display name was
  // "Hip Adductors Machine" and it was used to log inner-thigh
  // adduction work. Folded into the correctly-named `adductors`.
  'hip-flexors': 'adductors',
  // Custom-exercise retirement: the two real user-created customs were
  // promoted into the library; their `custom-*` history ids resolve to
  // the canonical entries here so existing workouts render correctly
  // without any DB rewrite. (Junk test customs were deleted, not aliased.)
  'custom-e609e9b2': 'cable-chest-press',   // "לחיצת חזה בכבל" (Tomer)
  'custom-b610b359': 'seated-cable-row',    // "Row" (Tom)
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
