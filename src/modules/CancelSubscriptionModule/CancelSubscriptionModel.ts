import { Document } from "mongoose";

export interface ICancelSubscription extends Document {
  subscriptionId: string;
  firstName: string;
  lastName: string;
  email: string;
  userId: string;
  isCancelled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  description: string;
}

import mongoose, { Schema } from "mongoose";

// 2️⃣ Create Schema with Generics
const cancelSubscriptionSchema = new Schema<ICancelSubscription>(
  {
    subscriptionId: {
      type: String,
      required: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    isCancelled: {
      type: Boolean,
      required: true,
      default: false,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
  },
  { timestamps: true }
);

// 3️⃣ Export Model
export default mongoose.model<ICancelSubscription>(
  "CancelSubscription",
  cancelSubscriptionSchema
);