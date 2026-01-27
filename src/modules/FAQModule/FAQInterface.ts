// 1️⃣ Define Type (Interface)
export interface IFaq extends Document {
  question: string;
  answer: string;
  videoUrl?: string;
}