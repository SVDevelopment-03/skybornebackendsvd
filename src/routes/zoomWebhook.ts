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
  console.log(JSON.stringify(req.body, null, 2));
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
    console.log("JOIN →", email);

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
    console.log("JOIN saved.");
  }

  // ======================================================
  // PARTICIPANT LEFT
  // ======================================================
  if (event === "meeting.participant_left") {
    console.log("LEFT →", email);

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
      console.log("LEFT saved → duration:", duration / 60000, "minutes");
    }
  }

  // logs for meeting lifecycle
  if (event === "meeting.started") console.log("MEETING STARTED");
  if (event === "meeting.ended") console.log("MEETING ENDED");

  return res.status(200).send("OK");
});

export default router;
