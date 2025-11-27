import mongoose, { Schema, Document } from "mongoose";
import { IFaq } from "./FAQInterface";



// 2️⃣ Create Schema with Generics
const faqSchema = new Schema<IFaq>(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// 3️⃣ Export Model
export default mongoose.model<IFaq>("Faq", faqSchema);
