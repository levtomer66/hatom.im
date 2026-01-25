import mongoose, { Schema, Document, Model } from 'mongoose';
import { Workout, WorkoutExercise, UserId, WorkoutType } from '@/types/workout';

// Mongoose document interface
export interface WorkoutDocument extends Omit<Workout, '_id' | 'id'>, Document {}

// Sub-schema for workout exercises
const WorkoutExerciseSchema = new Schema<WorkoutExercise>({
  id: { type: String, required: true },
  exerciseId: { type: String, required: true },
  scaleKg: { type: Number, default: null },
  set1Reps: { type: Number, default: null },
  set2Reps: { type: Number, default: null },
  set3Reps: { type: Number, default: null },
  notes: { type: String, default: '' },
  photos: { type: [String], default: [] },
}, { _id: false });

// Main workout schema
const WorkoutSchema = new Schema<WorkoutDocument>({
  userId: { 
    type: String, 
    required: true,
    enum: ['tom', 'tomer'] as UserId[],
    index: true,
  },
  workoutType: { 
    type: String, 
    required: true,
    enum: ['pull', 'push', 'legs', 'calisthenics', 'full-body', 'upper-body', 'lower-body'] as WorkoutType[],
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
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// Compound index for efficient queries
WorkoutSchema.index({ userId: 1, date: -1 });
WorkoutSchema.index({ userId: 1, 'exercises.exerciseId': 1 });

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
