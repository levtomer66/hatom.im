import mongoose, { Schema, Document, Model } from 'mongoose';
import { Workout, WorkoutExercise, WorkoutSet } from '@/types/workout';

// Mongoose document interface
export interface WorkoutDocument extends Omit<Workout, '_id' | 'id'>, Document {}

// Sub-schema for workout sets
const WorkoutSetSchema = new Schema<WorkoutSet>({
  kg: { type: Number, default: null },
  reps: { type: Number, default: null },
  seconds: { type: Number, default: null },
}, { _id: false });

// Sub-schema for workout exercises
const WorkoutExerciseSchema = new Schema<WorkoutExercise>({
  id: { type: String, required: true },
  exerciseId: { type: String, required: true },
  order: { type: Number, required: true, default: 1 },  // Position in workout
  sets: { type: [WorkoutSetSchema], default: [] },
  notes: { type: String, default: '' },
  photos: { type: [String], default: [] },
  replacedFromExerciseId: { type: String, default: null },
}, { _id: false });

// Main workout schema
const WorkoutSchema = new Schema<WorkoutDocument>({
  // userId is the Auth.js session email after the SSO migration in PR 4.
  // No enum constraint — any signed-in identity is valid here.
  userId: {
    type: String,
    required: true,
    index: true,
  },
  templateId: {
    type: String,
    default: null,
    index: true,
  },
  workoutName: { 
    type: String, 
    required: true,
    default: 'Workout',
  },
  date: { 
    type: String, 
    required: true,
    index: true,
  },
  exercises: { 
    type: [WorkoutExerciseSchema], 
    default: [] 
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  // Client-supplied UUID for idempotent creates — the offline PWA queue
  // could replay a POST if the original response never made it back to
  // the client (process kill mid-drain, mobile network flap). Sparse +
  // unique on (userId, clientRequestId) below, so a duplicate POST can
  // resolve to the same workout. CRITICAL: do NOT set a default of null
  // here — sparse indexes still index `null` values, so legacy/empty
  // rows would all collide on the same key. The route handler omits
  // the field entirely when the client doesn't supply one.
  clientRequestId: {
    type: String,
    required: false,
  },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// Compound index for efficient queries
WorkoutSchema.index({ userId: 1, date: -1 });
WorkoutSchema.index({ userId: 1, 'exercises.exerciseId': 1 });
WorkoutSchema.index({ userId: 1, clientRequestId: 1 }, { unique: true, sparse: true });

// Transform _id to id in JSON
WorkoutSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

// Model
let WorkoutModel: Model<WorkoutDocument>;

try {
  // Try to get existing model
  WorkoutModel = mongoose.model<WorkoutDocument>('Workout');
} catch {
  // Create new model if it doesn't exist
  WorkoutModel = mongoose.model<WorkoutDocument>('Workout', WorkoutSchema);
}

export default WorkoutModel;
