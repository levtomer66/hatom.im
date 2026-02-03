import mongoose, { Schema, Document, Model } from 'mongoose';
import { UserId } from '@/types/workout';

// Workout Template interface
export interface WorkoutTemplateData {
  id: string;
  userId: UserId;
  name: string;
  exerciseIds: string[];  // List of exercise IDs to include in this workout
  createdAt: string;
  updatedAt: string;
}

// Mongoose document interface
export interface WorkoutTemplateDocument extends Omit<WorkoutTemplateData, 'id'>, Document {}

// Main workout template schema
const WorkoutTemplateSchema = new Schema<WorkoutTemplateDocument>({
  userId: { 
    type: String, 
    required: true,
    enum: ['tom', 'tomer'] as UserId[],
    index: true,
  },
  name: { 
    type: String, 
    required: true,
  },
  exerciseIds: { 
    type: [String], 
    default: [] 
  },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
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
