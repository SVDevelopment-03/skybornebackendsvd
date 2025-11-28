import { Request, Response } from "express";
import axios from "axios";
import Meeting, { IMeeting } from "./MeetingModels/Meeting";
import MeetingAttendance from "./MeetingModels/MeetingAttendance";
import { getZoomAccessToken } from "../../utils/zoomAuth";
import crypto from "crypto";

export default class MeetingController {
  // -----------------------------------------
  // CREATE MEETING (ADMIN)
  // -----------------------------------------
  static async CreateMeeting(req: Request, res: Response) {
    const token = await getZoomAccessToken();

    const { topic, start_time, duration, adminId, local_time } = req.body;

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
      localTime: local_time,
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
      startTime: { $gte: oneHourAgo },
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

    if (!attendance) {
      attendance = await MeetingAttendance.create({
        meeting: meetingId,
        user: userId,
        sessions: [{ joinTime: new Date() }],
      });
    } else {
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

  // static async JoinMeeting(req: Request, res: Response) {
  //   const { meetingId, userId } = req.body;

  //   const meeting = await Meeting.findById(meetingId);
  //   if (!meeting) throw new Error("Meeting not found");

  //   const endTime =
  //     new Date(meeting.startTime).getTime() + meeting.duration * 60000;

  //   if (Date.now() > endTime) {
  //     return res.json({
  //       success: false,
  //       expired: true,
  //       message: "Meeting already ended",
  //     });
  //   }

  //   let attendance = await MeetingAttendance.findOne({
  //     meeting: meetingId,
  //     user: userId,
  //   });

  //   if (!attendance) {
  //     attendance = await MeetingAttendance.create({
  //       meeting: meetingId,
  //       user: userId,
  //       sessions: [],
  //       totalDuration: 0,
  //       progress: 0,
  //     });
  //   }

  //   const correlationToken = crypto.randomBytes(24).toString("hex");

  //   attendance.correlationToken = correlationToken;
  //   attendance.redirectedAt = new Date();
  //   attendance.status = "redirected";

  //   await attendance.save();

  //   const redirectUrl = `${process.env.FRONTEND_URL}/meeting-redirect?token=${correlationToken}`;

  //   return res.json({
  //     success: true,
  //     redirectUrl,
  //   });
  // }

  // static async RedirectZoom(req: Request, res: Response) {
  //   const { token } = req.body;

  //   const attendance = await MeetingAttendance.findOne({
  //     correlationToken: token,
  //   });

  //   if (!attendance) {
  //     return res.status(400).json({ error: "Invalid token" });
  //   }

  //   attendance.redirectedAt = new Date();
  //   attendance.status = "redirected";
  //   await attendance.save();

  //   const meeting = await Meeting.findById(attendance.meeting);

  //   return res.json({
  //     success: true,
  //     joinUrl: meeting?.joinUrl,
  //   });
  // }
}
