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
    name: 'Chest Low to High Cable Fly',
    categories: ['push'],
    defaultPhoto: pexels(32695897), // Cable machine workout
  },
  {
    id: 'pec-deck',
    name: 'Chest Pec Deck',
    categories: ['push'],
    defaultPhoto: pexels(18060022), // Chest machine
  },
  {
    id: 'free-chest-press',
    name: 'Chest Free Press',
    categories: ['push'],
    defaultPhoto: pexels(7187890), // Dumbbell press
  },
  {
    id: 'high-to-low-cable',
    name: 'Chest High to Low Cable Fly',
    categories: ['push'],
    defaultPhoto: pexels(5327510), // Cable machine workout
  },
  {
    id: 'chest-press-machine',
    name: 'Chest Press Machine',
    categories: ['push'],
    defaultPhoto: pexels(3888104), // Gym machine
  },
  {
    id: 'incline-chest-machine',
    name: 'Chest Incline Press Machine',
    categories: ['push'],
    defaultPhoto: pexels(3837388), // Gym machine
  },
  {
    id: 'bench-press',
    name: 'Chest Bench Press',
    categories: ['push'],
    defaultPhoto: pexels(3837781), // Bench press
  },
  {
    id: 'incline-bench-press',
    name: 'Chest Incline Bench Press',
    categories: ['push'],
    defaultPhoto: pexels(34651540), // Bench press
  },
  {
    id: 'dumbbell-press',
    name: 'Chest Dumbbell Press',
    categories: ['push'],
    defaultPhoto: pexels(3838698), // Dumbbell workout
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Chest Incline Dumbbell Press',
    categories: ['push'],
    defaultPhoto: pexels(18060077), // Dumbbell workout
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
    categories: ['push'],
    defaultPhoto: pexels(3837757), // Cable workout
  },
  // =====================
  // TRICEPS (Push)
  // =====================
  {
    id: 'v-bar-pushdown',
    name: 'Triceps V-Bar Pushdown',
    categories: ['push'],
    defaultPhoto: pexels(6243176), // Cable pushdown
  },
  {
    id: 'overhead-rope-press',
    name: 'Triceps Overhead Rope Extension',
    categories: ['push'],
    defaultPhoto: pexels(14623619), // Cable workout
  },
  {
    id: 'one-hand-cable-pushdown',
    name: 'Triceps One Hand Cable Pushdown',
    categories: ['push'],
    defaultPhoto: pexels(4164766), // Cable workout
  },
  {
    id: 'medial-one-arm-pull',
    name: 'Triceps Medial One Arm Pull',
    categories: ['push'],
    defaultPhoto: pexels(4164766), // Cable workout
  },
  {
    id: 'tricep-pushdown',
    name: 'Triceps Rope Pushdown',
    categories: ['push'],
    defaultPhoto: pexels(29218854), // Cable pushdown
  },
  {
    id: 'skull-crusher',
    name: 'Triceps Skull Crusher',
    categories: ['push'],
    defaultPhoto: pexels(4162438), // Tricep workout
  },
 
  // =====================
  // SHOULDERS (Push)
  // =====================
  {
    id: 'cable-lateral-raise',
    name: 'Shoulders Cable Lateral Raise (Low to 110°)',
    categories: ['push'],
    defaultPhoto: pexels(3837757), // Cable workout
  },
  {
    id: 'machine-shoulder-press',
    name: 'Shoulders Machine Press',
    categories: ['push'],
    defaultPhoto: pexels(4164761), // Machine press
  },
  {
    id: 'overhead-press',
    name: 'Shoulders Dumbbell Overhead Press',
    categories: ['push'],
    defaultPhoto: pexels(3837781), // Shoulder press
  },
  {
    id: 'front-raise',
    name: 'Shoulder Single-Arm Front Raise',
    categories: ['push'],
    defaultPhoto: pexels(3838937), // Dumbbell workout
  },

  // =====================
  // BACK (Pull)
  // =====================
  {
    id: 'lat-pulldown',
    name: 'Back Lat Pulldown',
    categories: ['pull'],
    defaultPhoto: pexels(4164587), // Lat pulldown
  },
  {
    id: 'v-bar-pull-belly',
    name: 'Back V-Bar Pull to Belly',
    categories: ['pull'],
    defaultPhoto: pexels(4164587), // Cable row
  },
  {
    id: 'wide-pull-belly',
    name: 'Back Wide Bar Pull to Belly',
    categories: ['pull'],
    defaultPhoto: pexels(4164587), // Cable row
  },
  {
    id: 'single-arm-lat-pullover',
    name: 'Back Single Arm Lat Pullover',
    categories: ['pull'],
    defaultPhoto: pexels(4164587), // Lat workout
  },
  {
    id: 'reverse-pec-deck',
    name: 'Back Reverse Pec Deck',
    categories: ['pull'],
    defaultPhoto: pexels(4162579), // Back machine
  },
  {
    id: 'face-pull',
    name: 'Face Pull',
    categories: ['pull'],
    defaultPhoto: pexels(4164766), // Cable face pull
  },
  {
    id: 'dumbbell-row',
    name: 'Back Dumbbell Row',
    categories: ['pull'],
    defaultPhoto: pexels(4162438), // Dumbbell row
  },
  {
    id: 'shrug',
    name: 'Shrug',
    categories: ['pull'],
    defaultPhoto: pexels(4162579), // Shrug
  },

  // =====================
  // BICEPS (Pull)
  // =====================
  {
    id: 'bayesian-curl',
    name: 'Biceps Single-Arm Bayesian Cable Curl',
    categories: ['pull'],
    defaultPhoto: pexels(4164766), // Cable curl
  },
  {
    id: 'bicep-dumbbell-curl',
    name: 'Biceps Single-Arm Dumbbell Curl',
    categories: ['pull'],
    defaultPhoto: pexels(4162438), // Dumbbell curl
  },
  {
    id: 'biceps-preacher-curl',
    name: 'Biceps Preacher Curl',
    categories: ['pull'],
    defaultPhoto: pexels(4162500), // Preacher curl
  },
  {
    id: 'seated-single-arm-preacher-curl',
    name: 'Biceps Seated Single-Arm Preacher Curl',
    categories: ['pull'],
    defaultPhoto: pexels(4162500), // Preacher curl
  },
  {
    id: 'seated-double-arm-preacher-curl',
    name: 'Biceps Seated Double-Arm Preacher Curl',
    categories: ['pull'],
    defaultPhoto: pexels(4162500), // Preacher curl
  },
  {
    id: 'seated-dumbbell-curl',
    name: 'Seated Dumbbell Curl (Short Head)',
    categories: ['pull'],
    defaultPhoto: pexels(4162438), // Seated curl
  },
  {
    id: 'brachialis-rope-curl',
    name: 'Brachialis Rope Curl',
    categories: ['pull'],
    defaultPhoto: pexels(4164766), // Rope curl
  },
  {
    id: 'hammer-curl',
    name: 'Biceps Hammer Curl',
    categories: ['pull'],
    defaultPhoto: pexels(4162438), // Hammer curl
  },

  // =====================
  // LEGS
  // =====================
  {
    id: 'calfs-leg-press',
    name: 'Calfs on Leg Press Machine',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Leg press
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension Machine',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Leg machine
  },
  {
    id: 'glute-kick',
    name: 'Glute Kick',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Glute workout
  },
  {
    id: 'leg-press',
    name: 'Leg Press Machine',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Leg press
  },
  {
    id: 'leg-curl',
    name: 'Leg Curl Machine',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Leg curl
  },
  {
    id: 'prone-leg-curl',
    name: 'Prone Leg Curl Machine',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Leg curl
  },
  {
    id: 'hip-abductors',
    name: 'Hip Abductors Machine',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Hip machine
  },
  {
    id: 'hip-flexors',
    name: 'Hip Flexors Machine',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Hip machine
  },
  {
    id: 'hip-thrust',
    name: 'Hip Thrust Machine',
    categories: ['legs'],
    defaultPhoto: pexels(4162451), // Hip thrust
  },
  {
    id: 'squat',
    name: 'Squat',
    categories: ['legs'],
    defaultPhoto: pexels(4164766), // Squat
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    categories: ['legs'],
    defaultPhoto: pexels(1552252), // Deadlift
  },
  {
    id: 'cable-romanian-deadlift',
    name: 'Cable Romanian Deadlift',
    categories: ['legs'],
    defaultPhoto: pexels(1552252), // Deadlift
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    categories: ['legs', 'full-body'],
    defaultPhoto: pexels(1552252), // Deadlift barbell
  },
  {
    id: 'lunge',
    name: 'Lunge',
    categories: ['legs'],
    defaultPhoto: pexels(4162451), // Lunge
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    categories: ['legs'],
    defaultPhoto: pexels(4162451), // Split squat
  },
  {
    id: 'calf-raise',
    name: 'Standing Calf Raise',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Calf raise
  },
  {
    id: 'hack-squat',
    name: 'Hack Squat',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Hack squat
  },
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    categories: ['legs'],
    defaultPhoto: pexels(4162438), // Goblet squat
  },
  {
    id: 'sumo-deadlift',
    name: 'Sumo Deadlift',
    categories: ['legs', 'full-body'],
    defaultPhoto: pexels(1552252), // Sumo deadlift
  },
  {
    id: 'glute-kickback',
    name: 'Glute Kickback',
    categories: ['legs'],
    defaultPhoto: pexels(4164512), // Glute kickback
  },
 

  // =====================
  // ABS (Full Body)
  // =====================
  {
    id: 'abs-machine',
    name: 'Abs Machine',
    categories: ['full-body'],
    defaultPhoto: pexels(4162487), // Abs workout
  },
  {
    id: 'cable-crunch',
    name: 'Cable Crunch',
    categories: ['full-body'],
    defaultPhoto: pexels(4162487), // Cable crunch
  },
  {
    id: 'ab-wheel',
    name: 'Ab Wheel',
    categories: ['full-body', 'calisthenics'],
    defaultPhoto: pexels(4162487), // Ab wheel
  },
  {
    id: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    categories: ['calisthenics', 'full-body'],
    defaultPhoto: pexels(4162451), // Hanging leg raise
  },
  {
    id: 'plank',
    name: 'Plank',
    categories: ['calisthenics', 'full-body'],
    defaultPhoto: pexels(4162487), // Plank
  },

  // =====================
  // CALISTHENICS
  // =====================
  {
    id: 'pull-up',
    name: 'Pull-Up',
    categories: ['calisthenics', 'pull'],
    defaultPhoto: pexels(4162451), // Pull-up bar
  },
  {
    id: 'parallels',
    name: 'Parallel Bars Dip',
    categories: ['calisthenics', 'push'],
    defaultPhoto: pexels(4162451), // Parallel bars
  },
  {
    id: 'weighted-parallels',
    name: 'Weighted Parallel Bars Dip',
    categories: ['calisthenics', 'push'],
    defaultPhoto: pexels(4162451), // Weighted dip
  },
  {
    id: 'chin-up',
    name: 'Chin-Up',
    categories: ['calisthenics', 'pull'],
    defaultPhoto: pexels(4162451), // Chin-up
  },
  {
    id: 'push-up',
    name: 'Push-Up',
    categories: ['calisthenics', 'push'],
    defaultPhoto: pexels(4162438), // Push-up
  },
  {
    id: 'dip',
    name: 'Dip (Bench Dips)',
    categories: ['calisthenics', 'push'],
    defaultPhoto: pexels(4162451), // Dip
  },
  {
    id: 'muscle-up',
    name: 'Muscle-Up',
    categories: ['calisthenics', 'full-body'],
    defaultPhoto: pexels(4162451), // Muscle-up
  },
  {
    id: 'pistol-squat',
    name: 'Pistol Squat',
    categories: ['calisthenics', 'legs'],
    defaultPhoto: pexels(4162451), // Pistol squat
  },
  {
    id: 'inverted-row',
    name: 'Inverted Row',
    categories: ['calisthenics', 'pull'],
    defaultPhoto: pexels(4162485), // Inverted row
  },
  {
    id: 'l-sit',
    name: 'L-Sit',
    categories: ['calisthenics', 'full-body'],
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
