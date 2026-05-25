import mongoose, { Schema, Document, Model } from 'mongoose';

export type QuestionChoices = { tom: string | null; tomer: string | null };

export interface SexExpectationsSessionDocument extends Document {
  sessionKey: string;
  tomJoined: boolean;
  tomerJoined: boolean;
  tomChoice: string | null;
  tomerChoice: string | null;
  questionIndex: number;
  /** Per-question choices: { [questionId]: { tom, tomer } } */
  choices: Record<string, QuestionChoices>;
}

const SexExpectationsSessionSchema = new Schema<SexExpectationsSessionDocument>(
  {
    sessionKey: { type: String, required: true, unique: true, default: 'default' },
    tomJoined: { type: Boolean, default: false },
    tomerJoined: { type: Boolean, default: false },
    tomChoice: { type: String, default: null },
    tomerChoice: { type: String, default: null },
    questionIndex: { type: Number, default: 0 },
    choices: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

let SexExpectationsSessionModel: Model<SexExpectationsSessionDocument>;

try {
  SexExpectationsSessionModel = mongoose.model<SexExpectationsSessionDocument>('SexExpectationsSession');
} catch {
  SexExpectationsSessionModel = mongoose.model<SexExpectationsSessionDocument>(
    'SexExpectationsSession',
    SexExpectationsSessionSchema
  );
}

export default SexExpectationsSessionModel;
