import crypto from "crypto";
import express from "express";
import MeetingAttendance from "../modules/MeetingModule/MeetingModels/MeetingAttendance";
import Meeting from "../modules/MeetingModule/MeetingModels/Meeting";
import User from "../modules/UserModule/models/User";
import MeetingParticipant from "../modules/MeetingModule/MeetingModels/MeetingParticipant"; // New model

type TitleType = "yoga" | "zumba" | "specialty";
const router = express.Router();
const ZOOM_SECRET_TOKEN = process.env.ZOOM_SECRET_TOKEN!;

router.use(express.json());

// ======================================================
// URL VALIDATION (FIRST TIME ONLY)
// ======================================================
router.post("/zoom-webhook", async (req, res) => {
  const { event, payload } = req.body;

  // ---------------- URL VALIDATION ----------------
  if (event === "endpoint.url_validation") {
    const plainToken = payload?.plainToken;

    const encryptedToken = crypto
      .createHmac("sha256", ZOOM_SECRET_TOKEN)
      .update(plainToken)
      .digest("hex");

    return res.status(200).json({ plainToken, encryptedToken });
  }

  const zoomMeetingId = payload?.object?.id;
  const occurrenceId = payload?.object?.occurrence_id || null;
  const zoomParticipantId = payload?.object?.participant?.id;

  if (!zoomMeetingId) return res.status(200).send("OK");

  // ⭐⭐⭐ FIND CORRECT MEETING INSTANCE ⭐⭐⭐
  const meetingDoc = await Meeting.findOne(
    occurrenceId
      ? { zoomMeetingId, occurrenceId }
      : { zoomMeetingId, occurrenceId: null }
  );

  if (!meetingDoc) return res.status(200).send("OK");

  // ======================================================
  // RECORDING COMPLETED
  // ======================================================
  if (event === "recording.completed") {
    try {
      const files = payload?.object?.recording_files || [];

      const mp4File = files.find((f: any) => f.file_type === "MP4");
      if (!mp4File?.download_url) return res.status(200).send("OK");

      await Meeting.findByIdAndUpdate(meetingDoc._id, {
        recordingUrl: mp4File.download_url,
        status: "completed",
        isLive: false,
      });

      return res.status(200).send("OK");
    } catch {
      return res.status(200).send("OK");
    }
  }

  // ======================================================
  // PARTICIPANT JOINED
  // ======================================================
  if (event === "meeting.participant_joined") {
    await MeetingParticipant.findOneAndUpdate(
      {
        meetingId: meetingDoc._id,
        zoomParticipantId: null,
      },
      {
        zoomParticipantId,
        joinedAt: new Date(),
      }
    );

    return res.status(200).send("OK");
  }

  // ======================================================
  // PARTICIPANT LEFT
  // ======================================================
  if (event === "meeting.participant_left") {
    const participantRecord = await MeetingParticipant.findOne({
      zoomParticipantId,
      meetingId: meetingDoc._id,
    });

    if (!participantRecord) return res.status(200).send("OK");

    const user = await User.findById(participantRecord.userId);
    if (!user) return res.status(200).send("OK");

    let attendance = await MeetingAttendance.findOne({
      meeting: meetingDoc._id,
      user: user._id,
    });

    if (!attendance) {
      attendance = await MeetingAttendance.create({
        meeting: meetingDoc._id,
        user: user._id,
        sessions: [],
        status: "joined",
        totalDuration: 0,
        progress: 0,
      });
    }

    attendance.sessions.push({
      joinTime: new Date(),
      leaveTime: null,
    });

    await attendance.save();

    return res.status(200).send("OK");
  }

  // ======================================================
  // MEETING STARTED
  // ======================================================
  if (event === "meeting.started") {
    await Meeting.findByIdAndUpdate(meetingDoc._id, {
      status: "pending",
      isLive: true,
    });

    return res.status(200).send("OK");
  }

  // ======================================================
  // MEETING ENDED
  // ======================================================
  if (event === "meeting.ended") {
    await Meeting.findByIdAndUpdate(meetingDoc._id, {
      status: "completed",
      isLive: false,
    });

    return res.status(200).send("OK");
  }

  return res.status(200).send("OK");
});

export default router;
