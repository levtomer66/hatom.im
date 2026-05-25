import mongoose, { Schema, Document, Model } from 'mongoose';
import { ValentineProgress as IValentineProgress } from '@/types/valentine';

export interface ValentineProgressDocument
  extends Omit<IValentineProgress, 'experiencedPositionIds'>,
    Document {
  experiencedPositionIds: mongoose.Types.Array<string>;
}

const ValentineProgressSchema = new Schema<ValentineProgressDocument>(
  {
    coupleId: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    experiencedPositionIds: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

ValentineProgressSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

let ValentineProgressModel: Model<ValentineProgressDocument>;

try {
  ValentineProgressModel = mongoose.model<ValentineProgressDocument>(
    'ValentineProgress'
  );
} catch {
  ValentineProgressModel = mongoose.model<ValentineProgressDocument>(
    'ValentineProgress',
    ValentineProgressSchema
  );
}

export default ValentineProgressModel;
