import mongoose, { Schema, Document, Model } from 'mongoose';
import { UserId, TemplateExercise, USER_IDS } from '@/types/workout';

// Workout Template interface
export interface WorkoutTemplateData {
  id: string;
  userId: UserId;
  name: string;
  exercises: TemplateExercise[];
  createdAt: string;
  updatedAt: string;
}

// Mongoose document interface
export interface WorkoutTemplateDocument extends Omit<WorkoutTemplateData, 'id'>, Document {}

// Per-exercise entry in a template (default set count + notes)
const TemplateExerciseSchema = new Schema<TemplateExercise>({
  exerciseId: { type: String, required: true },
  numSets: { type: Number, required: true, default: 3, min: 1, max: 5 },
  notes: { type: String, default: '' },
}, { _id: false });

// Main workout template schema
const WorkoutTemplateSchema = new Schema<WorkoutTemplateDocument>({
  userId: {
    type: String,
    required: true,
    enum: USER_IDS as readonly UserId[],
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  exercises: {
    type: [TemplateExerciseSchema],
    default: [],
  },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  // Allow unknown fields (e.g. legacy exerciseIds on old docs) so reads don't strip them
  // before the route-layer fallback runs.
  strict: false,
});

// Compound index for efficient queries
WorkoutTemplateSchema.index({ userId: 1, name: 1 });

// Transform _id to id in JSON
WorkoutTemplateSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

// Model
let WorkoutTemplateModel: Model<WorkoutTemplateDocument>;

try {
  // Try to get existing model
  WorkoutTemplateModel = mongoose.model<WorkoutTemplateDocument>('WorkoutTemplate');
} catch {
  // Create new model if it doesn't exist
  WorkoutTemplateModel = mongoose.model<WorkoutTemplateDocument>('WorkoutTemplate', WorkoutTemplateSchema);
}

export default WorkoutTemplateModel;
