import { Request, Response } from "express";
import axios from "axios";
import Meeting, { IMeeting, IService } from "./MeetingModels/Meeting";
import MeetingAttendance from "./MeetingModels/MeetingAttendance";
import { getZoomAccessToken } from "../../utils/zoomAuth";
import mongoose, { Types } from "mongoose";
import MeetingParticipant from "./MeetingModels/MeetingParticipant";
import User from "../UserModule/models/User";
import Service from "../ServiceModule/models/Service";
import { ServiceType } from "../UserModule/interface/userInterface";

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
        console.warn(
          "⚠️ [CreateMeeting] Validation failed - Missing required fields"
        );
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
      console.log(
        "📊 [CreateMeeting] Zoom response status:",
        zoomResponse.status
      );

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
      console.error(
        "🔍 [CreateMeeting] Zoom API error data:",
        error.response?.data
      );
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
      const { search = "" } = req?.query;
      const userId = req.user?.id; // Assuming user is attached to request

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Fetch user with their plan
      const user = await User.findById(userId).select("plan");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Determine which service titles to filter based on plan
      let serviceTitles: string[] = [];

      if (user.plan === "gold-yoga") {
        serviceTitles = ["Yoga"];
      } else if (user.plan === "gold-zumba") {
        serviceTitles = ["Zumba Dance"];
      } else if (user.plan === "gold-mixed") {
        serviceTitles = ["Yoga", "Zumba Dance"];
      } else if (user.plan === "diamond" || user.plan === "platinum") {
        // Diamond and Platinum can see all classes
        serviceTitles = ["Yoga", "Zumba Dance", "Diet & Nutrition"];
      }

      // Fetch service IDs based on titles
      const services = await Service.find({
        title: { $in: serviceTitles },
      }).select("_id");

      const serviceIds = services.map((service) => service._id);

      const meetings = await Meeting.find({
        localTime: { $gte: oneHourAgo },
        title: { $regex: search, $options: "i" },
        service: { $in: serviceIds },
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
        userPlan: user.plan,
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
      const user = req.user;


      const userData = await User.findById(userId);
    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
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


    // Determine service type
    const serviceType = (meeting?.service as IService)?.title?.toLowerCase() == "zumba dance" ? "zumba": (meeting?.service as IService)?.title?.toLowerCase();
    console.log("service type", serviceType);
    
    if (!["yoga", "zumba", "specialty"].includes(serviceType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service type for meeting",
      });
    }

    // Check class credits
    const credits :any= userData.classCredits?.[serviceType as ServiceType]   || 0;

    if (credits <= 0) {
      return res.status(403).json({
        success: false,
        message: `You do not have enough ${serviceType} credits to join this session`,
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
            message:
              "Recording not yet available. Meeting may still be in progress or processing.",
            canRetry: true,
          });
        }
        accessUrl = meeting?.recordingUrl;
      }

      console.log("meeting id", meeting.zoomMeetingId);
      

      const participantRecord = await MeetingParticipant.create({
        meetingId,
        zoomMeetingId: meeting.zoomMeetingId, // ✅ Add this line
        userId: user!.id,
        email: user!.email,
        // zoomParticipantId will be filled when webhook fires
      });

      // Find or create attendance record
      let attendance = await MeetingAttendance.findOne({
        meeting: meetingId,
        user: userId
      });

      if (!attendance) {
        attendance = await MeetingAttendance.create({
          meeting: meetingId,
          user: userId,
          region, // Store which region user is accessing from
          joinedAt:new Date(),
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

  static async getSessionsWithPagination(req: Request, res: Response) {
    const { userId, status, page, limit } = req.query as {
      userId: string;
      status?: "registered" | "joined" | "completed" | "missed";
      page?: string;
      limit?: string;
    };

    try {
      const skip = (Number(page) - 1) * Number(limit);

      // Build filter object - only add status if provided
      const filter: any = {
        user: new Types.ObjectId(userId),
      };

      if (status) {
        filter.status = status;
      }

      const [data, total] = await Promise.all([
        MeetingAttendance.find(filter, {
          meeting: 1,
          user: 1,
          sessions: 1,
          totalDuration: 1,
          totalSessions: 1,
          completedAt: 1,
          joinedAt: 1,
          region: 1,
          progress: 1,
          status: 1,
        })
          .populate("meeting", "title description startTime duration")
          .sort({ completedAt: -1, joinedAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        MeetingAttendance.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error(`Error fetching sessions with status ${status}:`, error);
      throw error;
    }
  }

  // Add this to your MeetingController

  static async GetMonthlyAttendance(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      console.log("user", userId);
      
      const { period = "6months" } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Get current date and calculate back based on period
      const now = new Date();
      let monthsBack = 5; // default 6 months (including current)

      if (period === "3months") {
        monthsBack = 2; // 3 months including current
      } else if (period === "1year") {
        monthsBack = 11; // 12 months including current
      }

      const periodAgo = new Date(now);
      periodAgo.setMonth(periodAgo.getMonth() - monthsBack);

      // Aggregate attendance by month
      const monthlyData = await MeetingAttendance.aggregate([
        {
          $match: {
             user: new mongoose.Types.ObjectId(userId),
            status: { $in: ["joined", "completed"] },
            createdAt: {
              $gte: periodAgo,
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
          },
        },
      ]);

      console.log("monthlyData", monthlyData);
      
      // Format the response with month names
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      // Create an array of all months in the selected period
      const allMonths = [];
      for (let i = monthsBack; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        allMonths.push({
          month: monthNames[date.getMonth()],
          year: date.getFullYear(),
          monthNum: date.getMonth() + 1,
        });
      }

      // Map aggregated data to include all months with 0 count if no data
      const formattedData = allMonths.map((monthObj) => {
        const found = monthlyData.find(
          (item) =>
            item._id.month === monthObj.monthNum &&
            item._id.year === monthObj.year
        );
        return {
          month: monthObj.month,
          count: found ? found.count : 0,
        };
      });

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        success: true,
        data: formattedData,
      });
    } catch (error: any) {
      console.error("Error fetching monthly attendance:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching monthly attendance",
      });
    }
  }
}
