import mongoose, { Schema, Document, Model } from 'mongoose';
import { ExerciseCategory, UserId } from '@/types/workout';

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
  createdAt: Date;
}

const CustomExerciseSchema = new Schema<CustomExerciseDocument>({
  // userId is the Auth.js session email (post-PR-4 SSO migration).
  userId: {
    type: String,
    required: true,
    index: true,
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
}, {
  timestamps: { createdAt: 'createdAt' },
  // Pin the collection explicitly so it never depends on pluralization rules.
  collection: 'customexercises',
});

let CustomExerciseModel: Model<CustomExerciseDocument>;

try {
  CustomExerciseModel = mongoose.model<CustomExerciseDocument>('CustomExercise');
} catch {
  CustomExerciseModel = mongoose.model<CustomExerciseDocument>('CustomExercise', CustomExerciseSchema);
}

export default CustomExerciseModel;
