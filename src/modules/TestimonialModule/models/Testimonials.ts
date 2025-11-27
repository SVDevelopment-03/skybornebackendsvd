import mongoose, { Schema, Document, Types } from "mongoose";
import mongooseAutoPopulate from "mongoose-autopopulate";

export interface ITestimonial extends Document {
  title: string;
  description: string;
  userId: Types.ObjectId;
  isActive: boolean;
  user: { image: string; name: string; totalClasses: number };
}

const TestimonialSchema = new Schema<ITestimonial>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    user: {
      image: { type: String, required: true },
      name: { type: String, required: true },
      totalClasses: { type: Number, required: true },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// 🔥 Enable plugin globally for this schema
TestimonialSchema.plugin(mongooseAutoPopulate);

export default mongoose.model<ITestimonial>("Testimonial", TestimonialSchema);
