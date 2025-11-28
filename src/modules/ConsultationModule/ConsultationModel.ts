// src/modules/ConsultationModule/models/Consultation.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IConsultation extends Document {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
}

const consultationSchema = new Schema<IConsultation>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    service: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IConsultation>(
  "Consultation",
  consultationSchema
);
