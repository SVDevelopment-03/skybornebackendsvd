import { Document, Schema, model } from "mongoose";

export interface IMailLog extends Document {
  meetingId?: string;
  meetingTitle: string;
  meetingTime: Date;
  sentAt: Date;
  totalUsers: number;
}

const MailLogSchema = new Schema<IMailLog>(
  {
    meetingId: {
      type: String,
      required: false,
      trim: true,
    },
    meetingTitle: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    meetingTime: {
      type: Date,
      required: true,
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    totalUsers: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true },
);

export default model<IMailLog>("MailLog", MailLogSchema);
