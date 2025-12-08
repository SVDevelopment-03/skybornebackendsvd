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
  const zoomParticipantId = participant?.id; // Get participant ID

  if (!zoomMeetingId) return res.status(200).send("OK");

  // ======================================================
  // RECORDING COMPLETED
  // ======================================================
  if (event === "recording.completed") {
    console.log(
      "🎬 [RECORDING] Recording completed for meeting:",
      zoomMeetingId
    );

    try {
      const meetingDoc = await Meeting.findOne({ zoomMeetingId });
      if (!meetingDoc) {
        console.log("❌ [RECORDING] Meeting not found in DB →", zoomMeetingId);
        return res.status(200).send("OK");
      }

      const recordingFiles = payload?.object?.recording_files;

      if (!recordingFiles || recordingFiles.length === 0) {
        console.log("⚠️ [RECORDING] No recording files found in payload");
        return res.status(200).send("OK");
      }

      const recordingUrl = recordingFiles[0]?.download_url;

      if (!recordingUrl) {
        console.log("⚠️ [RECORDING] No download URL found in recording files");
        return res.status(200).send("OK");
      }

      await Meeting.findByIdAndUpdate(
        meetingDoc._id,
        { recordingUrl },
        { new: true }
      );

      console.log("✅ [RECORDING] Updated meeting with recording URL");
      console.log("📍 [RECORDING] Recording URL:", recordingUrl);

      return res.status(200).send("OK");
    } catch (error: any) {
      console.error(
        "❌ [RECORDING] Error updating recording URL:",
        error.message
      );
      return res.status(200).send("OK");
    }
  }

  const meetingDoc = await Meeting.findOne({ zoomMeetingId });
  if (!meetingDoc) {
    console.log("Meeting not found in DB →", zoomMeetingId);
    return res.status(200).send("OK");
  }

  if (event === "meeting.participant_joined") {
    const zoomParticipantId = payload.object.participant.id;

    // Assign Zoom ID to the first unmatched participant created earlier
    const participantRecord = await MeetingParticipant.findOneAndUpdate(
      {
        meetingId: meetingDoc._id,
        zoomParticipantId: null,
      },
      {
        zoomParticipantId,
        joinedAt: new Date(),
      },
      { new: true }
    );

    if (!participantRecord) {
      console.log("⚠️ No user waiting for Zoom ID");
      return res.status(200).send("OK");
    }

    console.log("Linked Zoom participant →", participantRecord.userId);
  }

  if (event === "meeting.participant_left") {
    console.log("👤 [JOIN] Participant ID →", zoomParticipantId);

    // Find user by zoomParticipantId
    const participantRecord = await MeetingParticipant.findOne({
      zoomParticipantId,
      meetingId: meetingDoc._id,
    });

    if (!participantRecord) {
      console.log(
        "⚠️ [JOIN] Participant record not found for ID:",
        zoomParticipantId
      );
      return res.status(200).send("OK");
    }

    const user = await User.findById(participantRecord.userId);
    if (!user) {
      console.log("User not found in DB →", participantRecord.userId);
      return res.status(200).send("OK");
    }

    console.log("👤 [JOIN] User matched →", user.email);

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

    // Update participant record with actual join time
    await MeetingParticipant.findByIdAndUpdate(participantRecord._id, {
      joinedAt: new Date(),
    });
    const meetingType = await Meeting.findById(meetingDoc._id);

    if (
      meetingType &&
      typeof meetingType.service === "object" &&
      "title" in meetingType.service && attendance?.status !== "joined"
    ) {
      const title = meetingType.service.title.toLowerCase();

      let userData: any = await User.findById(user._id);
      if (userData) {
        userData.classCredits[title] = (userData.classCredits[title] || 0) - 1;
        await userData.save();
        attendance.status = "joined";

        attendance.sessions.push({
          joinTime: new Date(),
          leaveTime: null,
        });

        await attendance.save();
      }
      console.log("Service Title:", title);
    }
  }

  // if (event === "meeting.participant_left") {
  //   console.log("👤 [LEAVE] Participant ID →", zoomParticipantId);

  //   // Find user by zoomParticipantId
  //   const participantRecord = await MeetingParticipant.findOne({
  //     zoomParticipantId,
  //     meetingId: meetingDoc._id,
  //   });

  //   if (!participantRecord) {
  //     console.log("⚠️ [LEAVE] Participant record not found for ID:", zoomParticipantId);
  //     return res.status(200).send("OK");
  //   }

  //   const user = await User.findById(participantRecord.userId);
  //   if (!user) {
  //     console.log("User not found in DB");
  //     return res.status(200).send("OK");
  //   }

  //   console.log("👤 [LEAVE] User matched →", user.email);

  //   const attendance = await MeetingAttendance.findOne({
  //     meeting: meetingDoc._id,
  //     user: user._id,
  //   });

  //   if (!attendance) return res.status(200).send("OK");

  //   const lastSession = attendance.sessions[attendance.sessions.length - 1];

  //   if (lastSession && !lastSession.leaveTime) {
  //     lastSession.leaveTime = new Date();

  //     const duration =
  //       lastSession.leaveTime.getTime() - lastSession.joinTime.getTime();

  //     attendance.totalDuration += duration;

  //     const meetingDurationMs = meetingDoc.duration * 60000;
  //     attendance.progress = Math.min(
  //       100,
  //       Math.round((attendance.totalDuration / meetingDurationMs) * 100)
  //     );

  //     await attendance.save();
  //     console.log(
  //       "✅ [LEAVE] Session saved → duration:",
  //       duration / 60000,
  //       "minutes"
  //     );
  //   }

  //   // Update participant record with leave time
  //   await MeetingParticipant.findByIdAndUpdate(participantRecord._id, {
  //     leftAt: new Date(),
  //   });
  // }

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
