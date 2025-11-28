import mongoose, { Schema, Document } from "mongoose";

interface INewsletterSubscriber {
  email: string;
  createdAt: Date;
}

export interface SubscribeDto {
  email: string;
}

export interface NewsletterDocument extends INewsletterSubscriber, Document {}

const NewsletterSchema = new Schema<NewsletterDocument>(
  {
    email: { type: String, required: true, unique: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.model<NewsletterDocument>(
  "NewsletterSubscriber",
  NewsletterSchema
);
