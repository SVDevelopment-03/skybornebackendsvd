import { Schema, model, Document, Types } from "mongoose";
import { IMeeting } from "./Meeting";
import autopopulate from "mongoose-autopopulate";

export interface ISession {
  joinTime: Date;
  leaveTime?: Date | null;
  zoomParticipantId?: string; 
}

export interface IMeetingAttendance extends Document {
  meeting: IMeeting | Types.ObjectId;
  user: Types.ObjectId;

  sessions: ISession[];

  totalDuration: number;
  progress: number;

  correlationToken?: string;  // 🔥 Used to verify identity from Zoom
  redirectedAt?: Date;        // 🔥 When user clicked "Join"
  status?: string;            // e.g. "redirected", "joined", "left"
}

const SessionSchema = new Schema<ISession>(
  {
    joinTime: { type: Date, required: true },
    leaveTime: { type: Date, default: null },
    zoomParticipantId: { type: String },
  },
  { _id: false }
);

const MeetingAttendanceSchema = new Schema<IMeetingAttendance>(
  {
    meeting: {
      type: Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      autopopulate: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      autopopulate: true,
    },

    sessions: {
      type: [SessionSchema],
      default: [],
    },

    totalDuration: {
      type: Number,
      default: 0,
    },

    progress: {
      type: Number,
      default: 0,
    },

    correlationToken: {
      type: String,
      index: true,
    },

    redirectedAt: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["redirected", "joined", "left"],
      default: "redirected",
    },
  },
  { timestamps: true }
);

MeetingAttendanceSchema.plugin(autopopulate);

export default model<IMeetingAttendance>(
  "MeetingAttendance",
  MeetingAttendanceSchema
);
