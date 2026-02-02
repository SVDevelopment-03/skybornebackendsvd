// modules/PaymentModule/models/Payment.ts

import mongoose, { Schema, Document } from 'mongoose';

interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  orderRef: string;
  reference?: string;
  amount: number;
  source?:string;
  localAmount: number;
  billingType?: string;
  subscriptionActivated?: true;
  plan: string;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  gateway: 'ngenius' | 'stripe';
  
  // nGenius specific
  ngeniusStatus?: string;
  paymentLink?: string;
  
  
  // Stripe specific
  paymentIntentId?: string;
  subscriptionId?: string;
  
  // Common fields
  invoiceId?: string;
  gatewayResponse?: Record<string, any>;
  isRecurring: boolean;
  recurringCycle?: string;
  billingAttempt: number;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
       // ✅ NEW FIELD: Prevents double subscription activation
    subscriptionActivated: {
      type: Boolean,
      default: false,
      index: true, // Add index for faster queries
    },
    reference: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    localAmount: {
      type: Number,
    },
    plan: {
      type: String,
      required: true,
      enum: [
        'gold-yoga',
        'gold-zumba',
        'gold-mixed',
        'diamond',
        'platinum',
      ],
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    gateway: {
      type: String,
      enum: ['ngenius', 'stripe'],
      required: false,
      index: true,
    },
    source: {
      type: String,
      required: false,
    },

    // nGenius specific
    ngeniusStatus: {
      type: String,
      sparse: true,
    },
    paymentLink: {
      type: String,
      sparse: true,
    },

    // Stripe specific
    paymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    subscriptionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // Common fields
    invoiceId: {
      type: String,
      sparse: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Recurring payment fields
    isRecurring: {
      type: Boolean,
      default: true,
      index: true,
    },
    recurringCycle: {
      type: String, // Format: "YYYY-MM"
      sparse: true,
      index: true,
    },
    billingType: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    billingAttempt: {
      type: Number,
      default: 1,
    },
    verifiedAt: {
      type: Date,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
PaymentSchema.index({ userId: 1, isRecurring: 1, status: 1 });
PaymentSchema.index({ recurringCycle: 1, status: 1 });
PaymentSchema.index({ gateway: 1, status: 1 });
PaymentSchema.index({ createdAt: -1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);