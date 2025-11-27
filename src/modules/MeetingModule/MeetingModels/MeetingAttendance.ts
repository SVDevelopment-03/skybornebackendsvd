import { Schema, model, Document, Types } from "mongoose";
import { IMeeting } from "./Meeting";
import autopopulate from "mongoose-autopopulate";

// -----------------------------
// Session Interface
// -----------------------------
export interface ISession {
  joinTime: Date;
  leaveTime?: Date | null;
}

// -----------------------------
// Attendance Interface
// meeting → populated or ObjectId
// -----------------------------
export interface IMeetingAttendance extends Document {
  meeting: IMeeting | Types.ObjectId;   // <-- FIXED
  user: Types.ObjectId;
  sessions: ISession[];
  totalDuration: number;                // in milliseconds
  progress: number;                     // percentage
}

// -----------------------------
// Session Schema (subdocument)
// -----------------------------
const SessionSchema = new Schema<ISession>(
  {
    joinTime: { type: Date, required: true },
    leaveTime: { type: Date, default: null },
  },
  { _id: false } // Do NOT create _id for each session
);

// -----------------------------
// Meeting Attendance Schema
// -----------------------------
const MeetingAttendanceSchema = new Schema<IMeetingAttendance>(
  {
    meeting: {
      type: Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      autopopulate: true,              // <-- autopopulate FIX
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      autopopulate: true,              // optional but useful
    },

    sessions: {
      type: [SessionSchema],
      default: [],
    },

    totalDuration: {
      type: Number,
      default: 0,                      // milliseconds
    },

    progress: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Enable autopopulate
MeetingAttendanceSchema.plugin(autopopulate);

// -----------------------------
// Export Model
// -----------------------------
export default model<IMeetingAttendance>(
  "MeetingAttendance",
  MeetingAttendanceSchema
);
