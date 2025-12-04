import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderRef: { type: String, required: true },
    amount: { type: Number, required: true },
    plan: { type: String, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },
    gatewayResponse: { type: Object },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", PaymentSchema);
