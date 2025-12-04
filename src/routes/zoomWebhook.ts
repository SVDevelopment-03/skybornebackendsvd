import crypto from "crypto";
import express from "express";
import MeetingAttendance from "../modules/MeetingModule/MeetingModels/MeetingAttendance";
import Meeting from "../modules/MeetingModule/MeetingModels/Meeting";
import User from "../modules/UserModule/models/User";

const router = express.Router();
const ZOOM_SECRET_TOKEN = process.env.ZOOM_SECRET_TOKEN!;

router.use(express.json());

// ======================================================
// URL VALIDATION (FIRST TIME ONLY)
// ======================================================
router.post("/zoom-webhook", async (req, res) => {
  console.log("\n===== ZOOM WEBHOOK RECEIVED =====");
  console.log("Event:", req.body.event);
  console.log("=================================\n");

  const { event, payload } = req.body;

  // URL validation
  if (event === "endpoint.url_validation") {
    const plainToken = payload?.plainToken;

    const encryptedToken = crypto
      .createHmac("sha256", ZOOM_SECRET_TOKEN)
      .update(plainToken)
      .digest("hex");

    return res.status(200).json({ plainToken, encryptedToken });
  }

  const zoomMeetingId = payload?.object?.id;
  const participant = payload?.object?.participant;

  if (!zoomMeetingId) return res.status(200).send("OK");

  // ======================================================
  // RECORDING COMPLETED
  // ======================================================
  if (event === "recording.completed") {
    console.log("🎬 [RECORDING] Recording completed for meeting:", zoomMeetingId);

    try {
      const meetingDoc = await Meeting.findOne({ zoomMeetingId });
      if (!meetingDoc) {
        console.log("❌ [RECORDING] Meeting not found in DB →", zoomMeetingId);
        return res.status(200).send("OK");
      }

      // Extract recording URL from payload
      const recordingFiles = payload?.object?.recording_files;
      
      if (!recordingFiles || recordingFiles.length === 0) {
        console.log("⚠️ [RECORDING] No recording files found in payload");
        return res.status(200).send("OK");
      }

      // Get the first recording file (video file)
      const recordingUrl = recordingFiles[0]?.download_url;
      
      if (!recordingUrl) {
        console.log("⚠️ [RECORDING] No download URL found in recording files");
        return res.status(200).send("OK");
      }

      // Update meeting with recording URL
      await Meeting.findByIdAndUpdate(
        meetingDoc._id,
        { recordingUrl },
        { new: true }
      );

      console.log("✅ [RECORDING] Updated meeting with recording URL");
      console.log("📍 [RECORDING] Recording URL:", recordingUrl);
      
      return res.status(200).send("OK");
    } catch (error: any) {
      console.error("❌ [RECORDING] Error updating recording URL:", error.message);
      return res.status(200).send("OK"); // Still return 200 to acknowledge
    }
  }

  const meetingDoc = await Meeting.findOne({ zoomMeetingId });
  if (!meetingDoc) {
    console.log("Meeting not found in DB →", zoomMeetingId);
    return res.status(200).send("OK");
  }

  // Zoom usually gives user email
  const email = participant?.user_email;
  const name = participant?.user_name;

  // Link participant to your user database
  const user = await User.findOne({ email });
  if (!user) {
    console.log("User not found in DB →", email);
    return res.status(200).send("OK");
  }

  // ======================================================
  // PARTICIPANT JOINED
  // ======================================================
  if (event === "meeting.participant_joined") {
    console.log("👤 [JOIN] Participant joined →", email);

    let attendance = await MeetingAttendance.findOne({
      meeting: meetingDoc._id,
      user: user._id,
    });

    if (!attendance) {
      attendance = await MeetingAttendance.create({
        meeting: meetingDoc._id,
        user: user._id,
        sessions: [],
        totalDuration: 0,
        progress: 0,
      });
    }

    attendance.sessions.push({
      joinTime: new Date(),
      leaveTime: null,
    });

    await attendance.save();
    console.log("✅ [JOIN] Session saved");
  }

  // ======================================================
  // PARTICIPANT LEFT
  // ======================================================
  if (event === "meeting.participant_left") {
    console.log("👤 [LEAVE] Participant left →", email);

    const attendance = await MeetingAttendance.findOne({
      meeting: meetingDoc._id,
      user: user._id,
    });

    if (!attendance) return res.status(200).send("OK");

    const lastSession = attendance.sessions[attendance.sessions.length - 1];

    if (lastSession && !lastSession.leaveTime) {
      lastSession.leaveTime = new Date();

      const duration =
        lastSession.leaveTime.getTime() - lastSession.joinTime.getTime();

      attendance.totalDuration += duration;

      const meetingDurationMs = meetingDoc.duration * 60000;
      attendance.progress = Math.min(
        100,
        Math.round((attendance.totalDuration / meetingDurationMs) * 100)
      );

      await attendance.save();
      console.log("✅ [LEAVE] Session saved → duration:", duration / 60000, "minutes");
    }
  }

  // ======================================================
  // MEETING LIFECYCLE
  // ======================================================
  if (event === "meeting.started") {
    console.log("🎬 [MEETING] Meeting started →", zoomMeetingId);
  }

  if (event === "meeting.ended") {
    console.log("🏁 [MEETING] Meeting ended →", zoomMeetingId);
  }

  return res.status(200).send("OK");
});

export default router;