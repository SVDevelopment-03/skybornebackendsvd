import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderRef: { type: String, required: true, unique: true }, // Your internal reference
    reference: { type: String, unique: true, sparse: true }, // ✅ nGenius reference (added)
    amount: { type: Number, required: true },
    plan: { type: String, required: true },
    currency: { type: String, required: true },
    status: { 
      type: String, 
      enum: ["PENDING", "COMPLETED", "FAILED", "CANCELLED"], 
      default: "PENDING" 
    },
    ngeniusStatus: { type: String }, // ✅ Store nGenius status separately (added)
    paymentLink: { type: String }, // ✅ Store payment link (added)
    gatewayResponse: { type: Object },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", PaymentSchema);
