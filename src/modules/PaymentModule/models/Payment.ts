import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderRef: { type: String, required: true, unique: true }, // Your internal reference
    reference: { type: String, unique: true, sparse: true }, // ✅ nGenius reference
    amount: { type: Number, required: true },
    plan: { type: String, required: true },
    currency: { type: String, required: true },
    status: { 
      type: String, 
      // enum: ["PENDING", "COMPLETED", "FAILED", "CANCELLED"], 
      default: "PENDING" 
    },
    ngeniusStatus: { type: String },
    paymentLink: { type: String },
    gatewayResponse: { type: Object },
    
    // ✅ Recurring payment fields (minimal addition)
    isRecurring: { 
      type: Boolean, 
      default: true,
      index: true 
    },
    recurringCycle: { 
      type: String, // Format: "YYYY-MM"
      index: true,
      sparse: true
    },
    billingAttempt: { 
      type: Number, 
      default: 1 
    },
    verifiedAt: { 
      type: Date,
      sparse: true
    },
  },
  { timestamps: true }
);

// Index for finding recurring payments efficiently
PaymentSchema.index({ userId: 1, isRecurring: 1, status: 1 });
PaymentSchema.index({ recurringCycle: 1, status: 1 });

export default mongoose.model("Payment", PaymentSchema);