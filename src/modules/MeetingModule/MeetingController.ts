import { Request, Response } from "express";
import axios from "axios";
import Meeting, { IMeeting } from "./MeetingModels/Meeting";
import MeetingAttendance from "./MeetingModels/MeetingAttendance";
import { getZoomAccessToken } from "../../utils/zoomAuth";

export default class MeetingController {
  // -----------------------------------------
  // CREATE MEETING (ADMIN)
  // -----------------------------------------
  static async CreateMeeting(req: Request, res: Response) {
    const token = await getZoomAccessToken();

    const { topic, start_time, duration, adminId,local_time } = req.body;

    // 1. Create meeting on Zoom
    const zoomResponse = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic,
        type: 2,
        start_time,
        duration,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const meetingId = zoomResponse.data.id;
    const password = zoomResponse.data.password;

    // Web client URL (browser only)
    const webJoinUrl = `https://app.zoom.us/wc/${meetingId}/join?pwd=${password}&browser=1`;

    const webStartUrl = `https://app.zoom.us/wc/${meetingId}/start?pwd=${password}&browser=1`;

    // 2. Save meeting in DB
    const meeting = await Meeting.create({
      zoomMeetingId: zoomResponse.data.id,
      topic,
      startTime: start_time,
      localTime:local_time,
      duration,
      joinUrl: webJoinUrl,
      startUrl: webStartUrl,
      createdBy: adminId,
    });

    return res.json({ success: true, meeting });
  }

  // -----------------------------------------
  // GET UPCOMING MEETINGS
  // -----------------------------------------
  static async GetUpcomingMeetings(req: Request, res: Response) {
     const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); 
    const meetings = await Meeting.find({
      startTime: { $gte: oneHourAgo  },
    })
      .sort({ startTime: 1 })
      .populate("createdBy", "firstName lastName email _id")
      .lean();
      res.setHeader("Cache-Control", "no-store");

    return res.json({
      success: true,
      count: meetings?.length,
      meetings,
    });
  }

  // -----------------------------------------
  // JOIN MEETING
  // -----------------------------------------
  static async JoinMeeting(req: Request, res: Response) {
    const { meetingId, userId } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) throw new Error("Meeting not found");

    // meeting expired check
    const endTime =
      new Date(meeting.startTime).getTime() + meeting.duration * 60000;
    if (Date.now() > endTime) {
      return res.json({
        success: false,
        expired: true,
        message: "Meeting already ended",
      });
    }

    let attendance = await MeetingAttendance.findOne({
      meeting: meetingId,
      user: userId,
    });

    // Create new attendance main document if first time
    if (!attendance) {
      attendance = await MeetingAttendance.create({
        meeting: meetingId,
        user: userId,
        sessions: [{ joinTime: new Date() }],
      });
    } else {
      // Create a NEW session (DO NOT reset old)
      attendance.sessions.push({ joinTime: new Date() });
      await attendance.save();
    }

    const role = meeting.createdBy.toString() === userId ? 1 : 0;

    return res.json({
      success: true,
      joinUrl: meeting.joinUrl,
      attendanceId: attendance._id,
      role,
    });
  }

  // -----------------------------------------
  // LEAVE MEETING
  // -----------------------------------------
  static async LeaveMeeting(req: Request, res: Response) {
    const { attendanceId } = req.body;

    if (!attendanceId) throw new Error("attendanceId is required");

    // autopopulate or explicit populate to ensure meeting doc is available
    const attendance = await MeetingAttendance.findById(attendanceId).populate(
      "meeting"
    );
    if (!attendance) throw new Error("Attendance not found");

    // make sure there is at least one session
    if (!attendance.sessions || attendance.sessions.length === 0) {
      throw new Error("No active session found for this attendance");
    }

    // Last session is the one being closed
    const lastIndex = attendance.sessions.length - 1;
    const lastSession = attendance.sessions[lastIndex];

    // If last session already has leaveTime, nothing to close
    if (lastSession.leaveTime) {
      // optionally respond with current progress
      return res.json({
        success: true,
        message: "Session already closed",
        progress: attendance.progress,
        totalMinutes: Math.round(attendance.totalDuration / 60000),
      });
    }

    lastSession.leaveTime = new Date();

    // Calculate this session's duration (ms)
    const sessionDuration =
      lastSession.leaveTime.getTime() - lastSession.joinTime.getTime();
    attendance.totalDuration =
      (attendance.totalDuration || 0) + sessionDuration;

    const meetingCandidate = attendance.meeting as any;

    if (!meetingCandidate || typeof meetingCandidate.duration !== "number") {
      throw new Error("Meeting duration missing — populate failed");
    }

    const meetingDoc = meetingCandidate as IMeeting;
    const meetingDurationMs = meetingDoc.duration * 60000;

    attendance.progress = Math.min(
      100,
      Math.round((attendance.totalDuration / meetingDurationMs) * 100)
    );

    await attendance.save();

    return res.json({
      success: true,
      progress: attendance.progress,
      totalMinutes: Math.round(attendance.totalDuration / 60000),
    });
  }
}
