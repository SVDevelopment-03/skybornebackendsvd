import mongoose, { Schema, Document } from 'mongoose';

export interface IPlanProduct extends Document {
  planKey: string;
  displayName?: string;
  description?: string;
  price?: number;
  currency?: string;
  billingType?: 'monthly' | 'yearly';
  appleProductIds?: string[];
  googleProductIds?: string[];
  stripePriceIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const PlanProductSchema = new Schema<IPlanProduct>(
  {
    planKey: { type: String, required: true, unique: true, index: true },
    displayName: { type: String },
    description: { type: String },
    price: { type: Number },
    currency: { type: String, uppercase: true },
    billingType: { type: String, enum: ['monthly', 'yearly'] },
    appleProductIds: { type: [String], default: [] },
    googleProductIds: { type: [String], default: [] },
    stripePriceIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model<IPlanProduct>('PlanProduct', PlanProductSchema);
