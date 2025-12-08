import { Schema, model } from "mongoose";

const MeetingParticipantSchema = new Schema({
  meetingId: {
    type: Schema.Types.ObjectId,
    ref: "Meeting",
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  zoomParticipantId: {
    type: String,
    required: false,
  },
  email: String,
  joinedAt: Date,
  leftAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // Auto-delete after 24 hours
  },
});

export default model("MeetingParticipant", MeetingParticipantSchema);
