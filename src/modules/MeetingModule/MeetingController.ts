import { Request, Response } from "express";
import axios from "axios";
import Meeting, { IMeeting } from "./MeetingModels/Meeting";
import MeetingAttendance from "./MeetingModels/MeetingAttendance";
import { getZoomAccessToken } from "../../utils/zoomAuth";
import crypto from "crypto";

export default class MeetingController {

static async CreateMeeting(req: Request, res: Response) {
  try {
    console.log("🚀 [CreateMeeting] Starting meeting creation process");
    console.log("📝 [CreateMeeting] Request body:", req.body);

    const token = await getZoomAccessToken();
    console.log("✅ [CreateMeeting] Zoom access token retrieved");

    const {
      service,
      title,
      liveRegion,
      liveTime,
      trainer,
      duration,
      autoRecording,
      rotationEnabled,
      startDate,
      localTime,
      regions,
      adminId,
    } = req.body;

    console.log("📋 [CreateMeeting] Extracted parameters:", {
      service,
      title,
      liveRegion,
      liveTime,
      trainer,
      duration,
      autoRecording,
      rotationEnabled,
      startDate,
      localTime,
      regions,
      adminId,
    });

    // Validate required fields
    if (
      !service ||
      !title ||
      !liveRegion ||
      !liveTime ||
      !trainer ||
      !duration ||
      !startDate ||
      !localTime ||
      !regions ||
      !adminId
    ) {
      console.warn("⚠️ [CreateMeeting] Validation failed - Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    console.log("✅ [CreateMeeting] All required fields validated");

    // Generate meeting topic
    const topic = `${title} - Live Class`;
    console.log("📌 [CreateMeeting] Meeting topic generated:", topic);

    // 1. Create ONE meeting on Zoom for the LIVE region only
    console.log("🔗 [CreateMeeting] Sending request to Zoom API...");
    console.log("📤 [CreateMeeting] Zoom payload:", {
      topic,
      type: 2,
      start_time: localTime,
      duration,
    });

    const zoomResponse = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic,
        type: 2, // Scheduled meeting
        start_time: localTime,
        duration,
        settings: {
          // Mute on entry for all participants
          mute_upon_entry: true,
          allow_multiple_audio_unmute: false,
          allow_participants_to_unmute_themselves: false,
          allow_participants_to_unmute: false,
          // Enable recording
          auto_recording: autoRecording ? "cloud" : "none",
          // Host video on
          host_video: true,
          // Participant video on
          participant_video: true,
          // Enable waiting room
          waiting_room: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ [CreateMeeting] Zoom API response received");
    console.log("📊 [CreateMeeting] Zoom response status:", zoomResponse.status);

    const meetingId = zoomResponse.data.id;
    const password = zoomResponse.data.password;

    console.log("🎯 [CreateMeeting] Meeting created on Zoom:", {
      meetingId,
      password,
    });

    // Web client URLs
    const webJoinUrl = `https://app.zoom.us/wc/${meetingId}/join?pwd=${password}&browser=1`;
    const webStartUrl = `https://app.zoom.us/wc/${meetingId}/start?pwd=${password}&browser=1`;

    console.log("🔗 [CreateMeeting] Generated URLs:", {
      webJoinUrl,
      webStartUrl,
    });

    // 2. Save ONE meeting with all regions in DB
    console.log("💾 [CreateMeeting] Saving meeting to database...");
    console.log("📍 [CreateMeeting] Regions data:", regions);

    const meetingRecord = await Meeting.create({
      zoomMeetingId: meetingId,
      service,
      title,
      regions, // Store all regions with mode (live/replay)
      liveRegion,
      liveTime,
      trainer,
      duration,
      autoRecording,
      rotationEnabled,
      isLive: true, // This is the live meeting
      startDate: new Date(startDate),
      localTime: new Date(localTime),
      joinUrl: webJoinUrl,
      startUrl: webStartUrl,
      recordingUrl: "", // Will be populated after recording is available
      createdBy: adminId,
    });

    console.log("✅ [CreateMeeting] Meeting saved to DB:", {
      id: meetingRecord._id,
      zoomMeetingId: meetingRecord.zoomMeetingId,
      isLive: meetingRecord.isLive,
      regionsCount: meetingRecord.regions.length,
      title: meetingRecord.title,
    });

    console.log("📊 [CreateMeeting] Regions breakdown:");
    meetingRecord.regions.forEach((region) => {
      console.log(`  - ${region.region}: ${region.mode}`);
    });

    const responseMessage = `Meeting "${title}" created successfully. Live session for ${liveRegion}. Recording available for other regions.`;

    console.log("📤 [CreateMeeting] Sending success response");
    console.log("📊 [CreateMeeting] Response summary:", {
      meetingId: meetingRecord._id,
      title: meetingRecord.title,
      regionsCount: meetingRecord.regions.length,
      message: responseMessage,
    });

    return res.json({
      success: true,
      data: {
        meeting: meetingRecord,
        message: responseMessage,
      },
    });
  } catch (error: any) {
    console.error("❌ [CreateMeeting] ERROR CAUGHT");
    console.error("📍 [CreateMeeting] Error type:", error.constructor.name);
    console.error("📝 [CreateMeeting] Error message:", error.message);
    console.error("🔍 [CreateMeeting] Zoom API error data:", error.response?.data);
    console.error("📊 [CreateMeeting] Full error object:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Error creating meeting",
      error: error.response?.data,
    });
  }
}


static async GetUpcomingMeetings(req: Request, res: Response) {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const meetings = await Meeting.find({
        localTime: { $gte: oneHourAgo },
      })
        .sort({ localTime: 1 })
        .populate("service", "title name _id")
        .populate("trainer", "name email _id")
        .populate("createdBy", "firstName lastName email _id")
        .lean();

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        success: true,
        count: meetings?.length,
        meetings,
      });
    } catch (error: any) {
      console.error("Error fetching upcoming meetings:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching upcoming meetings",
      });
    }
  }


static async JoinMeeting(req: Request, res: Response) {
  try {
    const { meetingId, userId, region } = req.body;

    // Validate required fields
    if (!meetingId || !userId || !region) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: meetingId, userId, region",
      });
    }

    // Find the meeting
    const meeting = await Meeting.findById(meetingId).populate(
      "createdBy",
      "_id"
    );

    
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Find the region entry for this specific region
    const regionEntry = meeting.regions.find(
      (r) => r.region.toLowerCase() === region.toLowerCase()
    );

    if (!regionEntry) {
      return res.status(404).json({
        success: false,
        message: `Region "${region}" not found in this meeting`,
      });
    }

    // Check if meeting has ended
    const meetingEndTime =
      new Date(meeting.localTime).getTime() + meeting.duration * 60000;
    const currentTime = Date.now();

    if (currentTime > meetingEndTime) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: "Meeting has already ended",
      });
    }

    // Determine the URL based on region mode
    let accessUrl: string;
    const isLiveMode = regionEntry.mode === "live";


    if (isLiveMode) {
      // For live mode, use the joinUrl (meeting is currently happening)
      accessUrl = meeting?.joinUrl;
    } else {
      // For replay mode, use the recordingUrl
      // Check if recording is available
      if (!meeting?.recordingUrl) {
        return res.status(400).json({
          success: false,
          message: "Recording not yet available. Meeting may still be in progress or processing.",
          canRetry: true,
        });
      }
      accessUrl = meeting?.recordingUrl;
    }

    // Find or create attendance record
    let attendance = await MeetingAttendance.findOne({
      meeting: meetingId,
      user: userId,
    });

    if (!attendance) {
      attendance = await MeetingAttendance.create({
        meeting: meetingId,
        user: userId,
        region, // Store which region user is accessing from
        sessions: [{ joinTime: new Date(), mode: regionEntry.mode }],
      });
    } else {
      // Add new session entry with mode info
      attendance.sessions.push({
        joinTime: new Date(),
        mode: regionEntry.mode,
      });
      await attendance.save();
    }

    // Determine user role (1 = trainer/admin, 0 = participant)
    const isTrainerOrAdmin =
      meeting.createdBy._id.toString() === userId ||
      meeting.trainer.toString() === userId;
    const role = isTrainerOrAdmin ? 1 : 0;

    return res.json({
      success: true,
      data: {
        accessUrl, // Returns joinUrl for live, recordingUrl for replay
        mode: regionEntry.mode,
        attendanceId: attendance._id,
        role,
        meetingDetails: {
          meetingId: meeting._id,
          region: regionEntry.region,
          timezone: regionEntry.timezone,
          localTime: regionEntry.localTime,
          service: meeting.service,
          trainer: meeting.trainer,
          liveRegion: meeting.liveRegion,
          duration: meeting.duration,
        },
      },
    });
  } catch (error: any) {
    console.error("Error joining meeting:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Error joining meeting",
    });
  }
}
  // -----------------------------------------
  // LEAVE MEETING
  // -----------------------------------------
  static async LeaveMeeting(req: Request, res: Response) {
    try {
      const { attendanceId, userId } = req.body;

      const attendance = await MeetingAttendance.findById(attendanceId);
      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: "Attendance record not found",
        });
      }

      // Update the last session with leave time
      if (attendance.sessions.length > 0) {
        const lastSession = attendance.sessions[attendance.sessions.length - 1];
        lastSession.leaveTime = new Date();

        // Calculate session duration in minutes
        const duration =
          (lastSession.leaveTime.getTime() - lastSession.joinTime.getTime()) /
          60000;
        lastSession.duration = Math.round(duration);
      }

      await attendance.save();

      return res.json({
        success: true,
        message: "Left meeting successfully",
        data: {
          attendanceId: attendance._id,
        },
      });
    } catch (error: any) {
      console.error("Error leaving meeting:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error leaving meeting",
      });
    }
  }
}