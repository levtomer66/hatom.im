import mongoose, { Schema, Document, Model } from 'mongoose';
import { ExerciseCategory, UserId } from '@/types/workout';

// Custom exercise document interface
export interface CustomExerciseDocument extends Document {
  userId: UserId;
  exerciseId: string;
  name: string;
  categories: ExerciseCategory[];
  photo?: string;
  createdAt: Date;
}

// Custom exercise schema
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
    enum: ['pull', 'push', 'legs', 'calisthenics', 'upper-body', 'lower-body', 'full-body'],
  },
  photo: { 
    type: String, 
    default: null,
  },
}, {
  timestamps: { createdAt: 'createdAt' },
});

// Model
let CustomExerciseModel: Model<CustomExerciseDocument>;

try {
  CustomExerciseModel = mongoose.model<CustomExerciseDocument>('CustomExercise');
} catch {
  CustomExerciseModel = mongoose.model<CustomExerciseDocument>('CustomExercise', CustomExerciseSchema);
}

export default CustomExerciseModel;
