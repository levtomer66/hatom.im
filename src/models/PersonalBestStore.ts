import mongoose, { Schema, Document, Model } from 'mongoose';
import { PersonalBest } from '@/types/workout';

// Materialized per-user personal-best map. Recomputed and stored when a
// workout is completed or deleted, so the read path (pb route + bootstrap) is
// a single O(1) document fetch instead of a full-collection scan. One doc per
// user, keyed by userId (the session email).
export interface PersonalBestStoreDocument extends Document {
  userId: string;
  pbMap: Record<string, PersonalBest>;
  updatedAt: Date;
}

const PersonalBestStoreSchema = new Schema<PersonalBestStoreDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    // The whole exerciseId → PersonalBest map. Mixed because keys are dynamic
    // exercise ids; minimize:false keeps empty objects from being stripped.
    pbMap: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' }, minimize: false },
);

let PersonalBestStoreModel: Model<PersonalBestStoreDocument>;
try {
  PersonalBestStoreModel = mongoose.model<PersonalBestStoreDocument>('PersonalBestStore');
} catch {
  PersonalBestStoreModel = mongoose.model<PersonalBestStoreDocument>('PersonalBestStore', PersonalBestStoreSchema);
}

export default PersonalBestStoreModel;
