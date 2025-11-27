import { Schema, model, Document, Types } from "mongoose";
import autopopulate from "mongoose-autopopulate";

// -----------------------------
// Meeting Interface
// -----------------------------
export interface IMeeting extends Document {
  zoomMeetingId: number;
  topic: string;
  startTime: Date;
  localTime: Date;
  duration: number;
  joinUrl: string;
  startUrl: string;
  createdBy: Types.ObjectId; // ADMIN who created meeting
}

// -----------------------------
// Meeting Schema
// -----------------------------
const MeetingSchema = new Schema<IMeeting>(
  {
    zoomMeetingId: {
      type: Number,
      required: true,
    },

    topic: {
      type: String,
      required: true,
      trim: true,
    },

    startTime: {
      type: Date,
      required: true,
    },
      localTime: {
      type: Date,
      required: true,
    },

    duration: {
      type: Number,
      required: true,
    },

    joinUrl: {
      type: String,
      required: true,
    },

    startUrl: {
      type: String,
      required: true,
    },

    // Admin or User who created meeting
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      autopopulate: true,
    },
  },
  { timestamps: true }
);

// Enable Autopopulate Plugin
MeetingSchema.plugin(autopopulate);

// -----------------------------
// Export Model
// -----------------------------
export default model<IMeeting>("Meeting", MeetingSchema);
