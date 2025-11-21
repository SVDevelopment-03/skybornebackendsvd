import mongoose from "mongoose";

const UserSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    planName: String,
    renewalDate: Date,
    status: { type: String, enum: ["ACTIVE", "EXPIRED", "CANCELLED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

export default mongoose.model("UserSubscription", UserSubscriptionSchema);
