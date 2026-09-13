import mongoose, { Schema, Document, Model } from 'mongoose';
import { ExerciseCategory, LoadMode, UserId } from '@/types/workout';

// Per-user custom exercise. Users can add exercises that aren't in the
// code-defined EXERCISE_LIBRARY; they live in the `customexercises`
// collection keyed by userId (the Auth.js session email) and carry a
// `custom-<hex>` id. Rendering resolves these ids through the customs the
// client loads (see WorkoutCustomExercisesContext) — they are intentionally
// NOT in the static library, so getExerciseById won't find them.
export interface CustomExerciseDocument extends Document {
  userId: UserId;
  exerciseId: string;
  name: string;
  categories: ExerciseCategory[];
  photo?: string;
  // How this custom's entered weight maps to load (see LoadMode). Default
  // 'standard'. `bodyweightFactor` applies only to bodyweight mode.
  loadMode?: LoadMode;
  bodyweightFactor?: number | null;
  // Soft-delete: hidden from pickers/browse but still resolves names in
  // history. Never hard-deleted, so past workouts/templates never orphan.
  retired: boolean;
  createdAt: Date;
}

const CustomExerciseSchema = new Schema<CustomExerciseDocument>({
  // userId is the Auth.js session email (post-PR-4 SSO migration).
  // No standalone index: the only read is listCustomExercises' filter+sort,
  // covered by the compound { userId, retired, createdAt } declared below.
  userId: {
    type: String,
    required: true,
  },
  exerciseId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  categories: {
    type: [String],
    required: true,
    // Mirrors the categories the AddExerciseForm offers + the route's
    // VALID_CATEGORIES. Keep these three in sync.
    enum: ['push', 'pull', 'legs', 'calisthenics', 'full-body'],
  },
  photo: {
    type: String,
    default: null,
  },
  loadMode: {
    type: String,
    enum: ['standard', 'bodyweight', 'barbell', 'dumbbell'],
    default: 'standard',
  },
  bodyweightFactor: {
    type: Number,
    default: null,
  },
  // No standalone index on this low-cardinality boolean — it's never queried
  // alone; it's the middle key of the compound below (retired-active first).
  retired: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: { createdAt: 'createdAt' },
  // Pin the collection explicitly so it never depends on pluralization rules.
  collection: 'customexercises',
});

// Serves listCustomExercises: find({ userId }).sort({ retired: 1, createdAt: -1 }).
// ESR — equality on userId, then the exact sort keys, so no in-memory sort.
CustomExerciseSchema.index({ userId: 1, retired: 1, createdAt: -1 });

let CustomExerciseModel: Model<CustomExerciseDocument>;

try {
  CustomExerciseModel = mongoose.model<CustomExerciseDocument>('CustomExercise');
} catch {
  CustomExerciseModel = mongoose.model<CustomExerciseDocument>('CustomExercise', CustomExerciseSchema);
}

export default CustomExerciseModel;
