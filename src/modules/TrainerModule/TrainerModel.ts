import mongoose, { Schema } from "mongoose";
import { Document } from "mongoose";

export interface ICoach extends Document {
  name: string;
  specialization?: string;
  experience?: number;
  image?: string;
}


const CoachesSchema = new Schema<ICoach>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: false,
      trim: true,
    },
    experience: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
      trim: false,
    },
  },
  { timestamps: true }
);

// Prevent model overwrite issue in Next.js (important!)
export default mongoose.models.Coach ||
  mongoose.model<ICoach>("Coach", CoachesSchema);
