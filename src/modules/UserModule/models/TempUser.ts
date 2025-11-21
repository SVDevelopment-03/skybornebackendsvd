import mongoose from "mongoose";

const TempUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    // After OTP verification = true
    otpVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("TempUser", TempUserSchema);
