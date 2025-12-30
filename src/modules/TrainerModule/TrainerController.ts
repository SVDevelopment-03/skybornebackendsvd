// ============================================================================
// Backend: trainerController.ts (COMPLETE UPDATED VERSION)
// ============================================================================
import { Request, Response } from "express";
import CoachServices from "./TrainerServices";
import Meeting from "../MeetingModule/MeetingModels/Meeting";
import { Types } from "mongoose";
import MeetingAttendance from "../MeetingModule/MeetingModels/MeetingAttendance";
import User from "../UserModule/models/User";
import Trainer from "./TrainerModel";
import extractPhoneDetails from "../../utils/extractPhoneDetail";

const trainerService = new CoachServices();

export default class TrainerController {
  async getAll(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const filter = (req.query.filter as string) || "";

      const skip = (page - 1) * limit;

      const result = await trainerService.getAll({
        search,
        skip,
        limit,
        filter,
      });

      return res.status(200).json({
        success: true,
        message: "Trainers fetched successfully",
        data: result.trainers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((result.total as number) / limit),
          total: result.total,
          limit,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error });
    }
  }

  async getAllActive(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const filter = (req.query.filter as string) || "";

    const skip = (page - 1) * limit;

    // Fetch only active trainers
    const result = await trainerService.getAllActive({
      search,
      skip,
      limit,
      filter,
    });

    return res.status(200).json({
      success: true,
      message: "Active trainers fetched successfully",
      data: result.trainers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil((result.total as number) / limit),
        total: result.total,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching active trainers:", error);
    return res.status(500).json({ success: false, error });
  }
}

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const trainer = await trainerService.getById(id);
      return res.status(200).json({
        success: true,
        message: "Trainer fetched successfully",
        data: trainer,
      });
    } catch (error) {
      return res.status(404).json({ success: false, error });
    }
  }

  /**
   * Create a new trainer and optionally register them as a user
   */
  async create(req: Request, res: Response) {
    try {
      console.log("🚀 [TrainerController] Creating trainer:", {
        name: req.body.name,
        email: req.body.email,
      });
      const { dialingCode, localNumber, countryCode, country } =
        extractPhoneDetails(req.body.phoneNumber);
      const {
        name,
        email,
        phoneNumber,
        specialization,
        experience,
        charges,
        password, // New field for user account
      } = req.body;

      // Validate required fields
      if (!name || !email || !specialization || charges === undefined) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: name, email, specialization, charges",
        });
      }

      // Check if email already exists
      const existingTrainer = await Trainer.findOne({ email });
      if (existingTrainer) {
        return res.status(409).json({
          success: false,
          message: "Trainer with this email already exists",
        });
      }

      // Check if user with this email already exists (if password is provided)
      if (password) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: "User with this email already exists",
          });
        }
      }

      // Create trainer
      const trainerData = {
        name,
        email,
        phoneNumber,
        specialization,
        experience,
        charges,
        status: "active",
      };

      const trainer = await Trainer.create(trainerData);
      console.log("✅ [TrainerController] Trainer created:", trainer._id);

      let user = null;

      // Register trainer as a user if password is provided
      if (password) {
        console.log("🔐 [TrainerController] Creating user account for trainer");

        // Create user account with trainer reference
        user = await User.create({
          firstName: name.split(" ")[0],
          lastName: name.split(" ").slice(1).join(" ") || "",
          email,
          phoneNumber,
          password: password,
          role: "trainer", // Set role as trainer
          trainer: trainer._id, // Link to trainer ✅ KEY FIX
          isActive: true,
          onboardingCompleted: true,
          dialingCode,
          country,
          countryCode,
        });

        // Update trainer with user reference
        trainer.userId = user._id;
        await trainer.save();

        console.log("✅ [TrainerController] User account created:", user._id);
      }

      return res.status(201).json({
        success: true,
        message: password
          ? "Trainer and user account created successfully"
          : "Trainer created successfully",
        data: {
          trainer: {
            _id: trainer._id,
            name: trainer.name,
            email: trainer.email,
            specialization: trainer.specialization,
            experience: trainer.experience,
            charges: trainer.charges,
            status: trainer.status,
          },
          user: user
            ? {
                _id: user._id,
                email: user.email,
                role: user.role,
                trainer: user.trainer,
                message:
                  "Login credentials: Email and password provided at creation",
              }
            : null,
        },
      });
    } catch (error: any) {
      console.error(
        "❌ [TrainerController] Error creating trainer:",
        error.message
      );
      return res.status(400).json({
        success: false,
        message: error.message || "Error creating trainer",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  }

  /**
   * Update trainer (password cannot be updated here - only through separate endpoint)
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        name,
        email,
        phoneNumber,
        specialization,
        experience,
        charges,
        status,
      } = req.body;

      console.log("🔄 [TrainerController] Updating trainer:", id);

      // Find and update trainer
      const trainer = await Trainer.findByIdAndUpdate(
        id,
        {
          name,
          email,
          phoneNumber,
          specialization,
          experience,
          charges,
          status,
        },
        { new: true, runValidators: true }
      ).populate("specialization");

      if (!trainer) {
        return res.status(404).json({
          success: false,
          message: "Trainer not found",
        });
      }

      // Update associated user if exists
      if (trainer.userId) {
        await User.findByIdAndUpdate(trainer.userId, {
          firstName: name?.split(" ")[0] || undefined,
          lastName: name?.split(" ").slice(1).join(" ") || undefined,
          phoneNumber,
        });
        console.log("✅ [TrainerController] Associated user updated");
      }

      console.log("✅ [TrainerController] Trainer updated successfully");

      return res.json({
        success: true,
        message: "Trainer updated successfully",
        data: trainer,
      });
    } catch (error: any) {
      console.error(
        "❌ [TrainerController] Error updating trainer:",
        error.message
      );
      return res.status(400).json({
        success: false,
        message: error.message || "Error updating trainer",
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await trainerService.delete(id);
      return res.status(200).json({
        success: true,
        message: "Trainer deleted successfully",
      });
    } catch (error) {
      return res.status(404).json({ success: false, error });
    }
  }

  /**
   * Helper method to get trainer ID from user ID
   */
  private static async getTrainerIdFromUser(userId: string): Promise<string> {
    const user = await User.findById(userId).select("trainer");
    if (!user?.trainer) {
      throw new Error("Trainer profile not found for this user");
    }
    return user.trainer.toString();
  }

  /**
   * Get trainer overview statistics
   * Sessions this month, monthly earnings, active students, completion rate
   */

  static async GetTrainerStats(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      console.log("user id", userId);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Get trainer ID
      const trainerId = await TrainerController.getTrainerIdFromUser(userId);
      console.log("trainer id", trainerId);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      /* =========================
        SESSIONS
      ========================= */
      const sessionsThisMonth = await Meeting.countDocuments({
        trainer: new Types.ObjectId(trainerId),
        status: "completed",
        localTime: { $gte: monthStart, $lte: monthEnd },
      });

      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const sessionsLastMonth = await Meeting.countDocuments({
        trainer: new Types.ObjectId(trainerId),
        status: "completed",
        localTime: { $gte: prevMonthStart, $lte: prevMonthEnd },
      });

      const sessionsChange =
        sessionsLastMonth > 0
          ? Math.round(
              ((sessionsThisMonth - sessionsLastMonth) / sessionsLastMonth) * 100
            )
          : 0;

      /* =========================
        ✅ EARNINGS (FIXED - Using Meeting Schema)
      ========================= */
      // Get this month's completed meetings
      const thisMonthMeetings = await Meeting.find({
        trainer: new Types.ObjectId(trainerId),
        status: "completed",
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }).lean();

      // Calculate earnings: $10 per session = 1000 cents
      const monthlyEarnings = thisMonthMeetings.length * 1000;

      // Get last month's completed meetings
      const lastMonthMeetings = await Meeting.find({
        trainer: new Types.ObjectId(trainerId),
        status: "completed",
        createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
      }).lean();

      const prevMonthEarnings = lastMonthMeetings.length * 1000;

      const earningsChange =
        prevMonthEarnings > 0
          ? Math.round(
              ((monthlyEarnings - prevMonthEarnings) / prevMonthEarnings) * 100
            )
          : 0;

      /* =========================
        ✅ ACTIVE STUDENTS (FIXED - Using Meeting Schema)
      ========================= */
      // Count unique creators (students) this month
      const thisMonthCreators = new Set(
        thisMonthMeetings.map((m) => m.createdBy.toString())
      );
      const activeStudentsCount = thisMonthCreators.size;

      // Count unique creators last month
      const lastMonthCreators = new Set(
        lastMonthMeetings.map((m) => m.createdBy.toString())
      );
      const prevActiveStudentsCount = lastMonthCreators.size;

      const studentsChange =
        prevActiveStudentsCount > 0
          ? Math.round(
              ((activeStudentsCount - prevActiveStudentsCount) /
                prevActiveStudentsCount) *
                100
            )
          : 0;

      /* =========================
        ✅ COMPLETION RATE (FIXED)
      ========================= */
      // Total sessions this month (excluding future sessions)
      const totalSessionsThisMonth = await Meeting.countDocuments({
        trainer: new Types.ObjectId(trainerId),
        localTime: { $gte: monthStart, $lte: now },
      });

      // Completed sessions this month
      const completedSessions = await Meeting.countDocuments({
        trainer: new Types.ObjectId(trainerId),
        status: "completed",
        localTime: { $gte: monthStart, $lte: monthEnd < now ? monthEnd : now  },
      });

      const completionRate =
        totalSessionsThisMonth > 0
          ? Math.round((completedSessions / totalSessionsThisMonth) * 100)
          : 0;

      /* ===== Previous Month Completion Rate ===== */
      const prevTotalSessions = await Meeting.countDocuments({
        trainer: new Types.ObjectId(trainerId),
        localTime: { $gte: prevMonthStart, $lte: prevMonthEnd },
      });

      const prevCompletedSessions = await Meeting.countDocuments({
        trainer: new Types.ObjectId(trainerId),
        status: "completed",
        localTime: { $gte: prevMonthStart, $lte: prevMonthEnd },
      });

      const prevCompletionRate =
        prevTotalSessions > 0
          ? Math.round((prevCompletedSessions / prevTotalSessions) * 100)
          : 0;

      const completionRateChange = completionRate - prevCompletionRate;

      return res.json({
        success: true,
        data: {
          sessionsThisMonth: {
            value: sessionsThisMonth,
            change: sessionsChange,
          },
          monthlyEarnings: {
            value: monthlyEarnings, // Already in cents (1000 = $10.00)
            change: earningsChange,
          },
          activeStudents: {
            value: activeStudentsCount,
            change: studentsChange,
          },
          completionRate: {
            value: completionRate,
            change: completionRateChange,
          },
        },
      });
    } catch (error: any) {
      console.error("Error fetching trainer stats:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching trainer stats",
      });
    }
  }

  /**
   * Get trainer earnings over a period
   */
  static async GetTrainerEarnings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { period = "6months" } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Get trainer ID from user ✅ KEY FIX
      const trainerId = await TrainerController.getTrainerIdFromUser(userId);

      const now = new Date();
      let monthsBack = 5;

      if (period === "3months") {
        monthsBack = 2;
      } else if (period === "1year") {
        monthsBack = 11;
      }

      const periodAgo = new Date(now);
      periodAgo.setMonth(periodAgo.getMonth() - monthsBack);

      const earningsData = await MeetingAttendance.aggregate([
        {
          $match: {
            createdAt: { $gte: periodAgo },
            status: { $in: ["joined", "completed"] },
          },
        },
        {
          $lookup: {
            from: "meetings",
            localField: "meeting",
            foreignField: "_id",
            as: "meetingData",
          },
        },
        {
          $unwind: "$meetingData",
        },
        {
          $match: {
            "meetingData.trainer": new Types.ObjectId(trainerId),
            "meetingData.status": "completed",
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
            earnings: { $sum: 1000 }, // $10 per attendance in cents
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
          },
        },
      ]);

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

      const formattedData = allMonths.map((monthObj) => {
        const found = earningsData.find(
          (item) =>
            item._id.month === monthObj.monthNum &&
            item._id.year === monthObj.year
        );
        return {
          month: monthObj.month,
          earnings: found ? found.earnings : 0,
        };
      });

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        success: true,
        data: {
          labels: formattedData.map((d) => d.month),
          values: formattedData.map((d) => d.earnings),
        },
      });
    } catch (error: any) {
      console.error("Error fetching earnings:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching earnings",
      });
    }
  }

  /**
   * Get student growth over time
   */
  static async GetStudentGrowth(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { period = "week" } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Get trainer ID from user ✅ KEY FIX
      const trainerId = await TrainerController.getTrainerIdFromUser(userId);

      const now = new Date();
      let daysBack = 7;

      if (period === "month") {
        daysBack = 30;
      } else if (period === "quarter") {
        daysBack = 90;
      }

      const periodAgo = new Date(
        now.getTime() - daysBack * 24 * 60 * 60 * 1000
      );

      const growthData = await MeetingAttendance.aggregate([
        {
          $match: {
            createdAt: { $gte: periodAgo },
            status: { $in: ["joined", "completed"] },
          },
        },
        {
          $lookup: {
            from: "meetings",
            localField: "meeting",
            foreignField: "_id",
            as: "meetingData",
          },
        },
        {
          $unwind: "$meetingData",
        },
        {
          $match: {
            "meetingData.trainer": new Types.ObjectId(trainerId),
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            uniqueStudents: { $addToSet: "$user" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 1,
            count: 1,
            uniqueStudentCount: { $size: "$uniqueStudents" },
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
            "_id.day": 1,
          },
        },
      ]);

      const labels = growthData.map((d) => {
        const date = new Date(d._id.year, d._id.month - 1, d._id.day);
        return date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });
      });

      const values = growthData.map((d) => d.uniqueStudentCount);

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        success: true,
        data: {
          labels,
          values,
        },
      });
    } catch (error: any) {
      console.error("Error fetching student growth:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching student growth",
      });
    }
  }

  /**
   * Get session attendance rates
   */
  static async GetSessionsAttendance(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { period = "1week" } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Get trainer ID from user
      const trainerId = await TrainerController.getTrainerIdFromUser(userId);

      const now = new Date();
      let startDate: Date;
      let labels: string[];
      let groupByDay = false;

      // Determine the date range and labels based on period
      if (period === "1week") {
        // Last 7 days
        startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        groupByDay = true;
        
        // Generate day labels (Mon, Tue, Wed, etc.)
        labels = [];
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        for (let i = 0; i < 7; i++) {
          const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
          labels.push(dayNames[date.getDay()]);
        }
      } else if (period === "1month") {
        // Current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupByDay = true;
        
        // Get number of days in current month
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid period. Use '1week' or '1month'",
        });
      }

      // Get all meetings in the period for this trainer
      const meetings = await Meeting.find({
        trainer: new Types.ObjectId(trainerId),
        localTime: { $gte: startDate, $lte: now },
      }).select("_id localTime").lean();

      if (meetings.length === 0) {
        // No meetings found, return zeros
        return res.json({
          success: true,
          data: {
            labels,
            values: new Array(labels.length).fill(0),
          },
        });
      }

      // Group meetings by day
      const meetingsByDay: { [key: string]: string[] } = {};
      
      if (period === "1week") {
        // Group by day of week
        meetings.forEach((meeting) => {
          const meetingDate = new Date(meeting.localTime);
          const daysDiff = Math.floor(
            (meetingDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
          );
          
          if (daysDiff >= 0 && daysDiff < 7) {
            const key = String(daysDiff);
            if (!meetingsByDay[key]) {
              meetingsByDay[key] = [];
            }
            meetingsByDay[key].push(meeting._id.toString());
          }
        });
      } else if (period === "1month") {
        // Group by day of month
        meetings.forEach((meeting) => {
          const meetingDate = new Date(meeting.localTime);
          const dayOfMonth = meetingDate.getDate();
          const key = String(dayOfMonth - 1); // 0-indexed
          
          if (!meetingsByDay[key]) {
            meetingsByDay[key] = [];
          }
          meetingsByDay[key].push(meeting._id.toString());
        });
      }

      // Calculate attendance rate for each day
      const attendanceRates: number[] = [];

      for (let i = 0; i < labels.length; i++) {
        const key = String(i);
        const dayMeetingIds = meetingsByDay[key];

        if (!dayMeetingIds || dayMeetingIds.length === 0) {
          attendanceRates.push(0);
          continue;
        }

        // Get attendance stats for this day's meetings
        const totalRegistered = await MeetingAttendance.countDocuments({
          meeting: { $in: dayMeetingIds.map(id => new Types.ObjectId(id)) },
          status: { $in: ["registered", "joined", "completed"] },
        });

        const attended = await MeetingAttendance.countDocuments({
          meeting: { $in: dayMeetingIds.map(id => new Types.ObjectId(id)) },
          status: { $in: ["joined", "completed"] },
        });

        // const rate = totalRegistered > 0
        //   ? Math.round((attended / totalRegistered) * 100)
        //   : 0;

        attendanceRates.push(attended);
      }

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        success: true,
        data: {
          labels,
          values: attendanceRates,
        },
      });
    } catch (error: any) {
      console.error("Error fetching attendance:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching attendance",
      });
    }
  }

  /**
   * Get top services by trainer
   */
  static async GetTopServices(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Get trainer ID from user ✅ KEY FIX
      const trainerId = await TrainerController.getTrainerIdFromUser(userId);

      const topServices = await Meeting.aggregate([
        {
          $match: {
            trainer: new Types.ObjectId(trainerId),
          },
        },
        {
          $group: {
            _id: "$service",
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "services",
            localField: "_id",
            foreignField: "_id",
            as: "serviceData",
          },
        },
        {
          $unwind: "$serviceData",
        },
        {
          $project: {
            _id: 0,
            service: "$serviceData.title",
            count: 1,
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 5,
        },
      ]);

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        success: true,
        data: topServices,
      });
    } catch (error: any) {
      console.error("Error fetching top services:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching top services",
      });
    }
  }


   static async getEarningsList(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const period = (req.query.period as string) || "6months";

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Get trainer ID from user
      const user = await User.findById(userId).select("trainer");
      if (!user?.trainer) {
        return res.status(404).json({
          success: false,
          message: "Trainer profile not found",
        });
      }

      const trainerId = user.trainer.toString();

      // Calculate date range based on period
      const now = new Date();
      let monthsBack = 5;

      if (period === "3months") {
        monthsBack = 2;
      } else if (period === "1year") {
        monthsBack = 11;
      }

      const periodAgo = new Date(now);
      periodAgo.setMonth(periodAgo.getMonth() - monthsBack);

      // Aggregate earnings data by month from Meeting schema only
      const earningsData = await Meeting.aggregate([
        {
          $match: {
            trainer: new Types.ObjectId(trainerId),
            status: "completed",
            createdAt: { $gte: periodAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            sessionCount: { $sum: 1 },
            totalDuration: { $sum: "$duration" },
            earnings: { $sum: "$duration" }, // Earnings based on duration in minutes
          },
        },
        {
          $project: {
            _id: 1,
            sessionCount: 1,
            totalDuration: 1,
            earnings: { $multiply: ["$sessionCount", 1000] }, // $10 per session in cents
          },
        },
        {
          $sort: {
            "_id.year": -1,
            "_id.month": -1,
          },
        },
      ]);

      // Enrich data with additional metrics
      const enrichedData = await Promise.all(
        earningsData.map(async (item) => {
          const monthStart = new Date(item._id.year, item._id.month - 1, 1);
          const monthEnd = new Date(item._id.year, item._id.month, 0);

          // Get all meetings for this trainer in this month
          const meetings = await Meeting.find({
            trainer: new Types.ObjectId(trainerId),
            createdAt: { $gte: monthStart, $lte: monthEnd },
          }).lean();

          // Count unique creators (students/participants who created meetings with this trainer)
          const uniqueCreators = new Set(
            meetings.map((m) => m.createdBy.toString())
          );
          const activeStudentsCount = uniqueCreators.size;

          // Calculate completion rate based on isLive status
          const liveCount = meetings.filter((m) => m.isLive).length;
          const completionRate =
            meetings.length > 0
              ? Math.round((liveCount / meetings.length) * 100)
              : 0;

          return {
            month: item._id.month.toString().padStart(2, "0"),
            year: item._id.year,
            earnings: item.earnings,
            sessions: item.sessionCount,
            activeStudents: activeStudentsCount,
            completionRate: completionRate,
          };
        })
      );

      // Apply search filter if provided
      let filtered = enrichedData;
      if (search) {
        filtered = enrichedData.filter((item) => {
          const monthStr = item.month;
          const yearStr = item.year.toString();
          return monthStr.includes(search) || yearStr.includes(search);
        });
      }

      // Pagination
      const total = filtered.length;
      const skip = (page - 1) * limit;
      const paginatedData = filtered.slice(skip, skip + limit);
      const totalPages = Math.ceil(total / limit);

      return res.status(200).json({
        success: true,
        message: "Earnings list fetched successfully",
        earnings: paginatedData,
        pagination: {
          currentPage: page,
          totalPages,
          total,
          limit,
        },
      });
    } catch (error: any) {
      console.error("Error fetching earnings list:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching earnings list",
      });
    }
  }

 
  /**
   * Get earnings summary statistics
   * Uses only Meeting schema
   * GET /trainer/earnings-summary
   */
  static async getEarningsSummary(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const user = await User.findById(userId).select("trainer");
      if (!user?.trainer) {
        return res.status(404).json({
          success: false,
          message: "Trainer profile not found",
        });
      }

      const trainerId = user.trainer.toString();
      const now = new Date();

      // This month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Last month
      const lastMonthStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get this month's meetings
      const thisMonthMeetings = await Meeting.find({
        trainer: new Types.ObjectId(trainerId),
        status: "completed",
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }).lean();

      const thisMonthSessionCount = thisMonthMeetings.length;
      const thisMonthEarnings = thisMonthSessionCount * 1000; // $10 per session in cents

      // Get last month's meetings
      const lastMonthMeetings = await Meeting.find({
        trainer: new Types.ObjectId(trainerId),
        status: "completed",
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      }).lean();

      const lastMonthSessionCount = lastMonthMeetings.length;
      const lastMonthEarnings = lastMonthSessionCount * 1000;

      // Calculate percentage changes
      const earningsChange =
        lastMonthEarnings > 0
          ? Math.round(
              ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) *
                100
            )
          : 0;

      const sessionsChange =
        lastMonthSessionCount > 0
          ? Math.round(
              ((thisMonthSessionCount - lastMonthSessionCount) /
                lastMonthSessionCount) *
                100
            )
          : 0;

      // Count active students (unique creators) this month
      const thisMonthCreators = new Set(
        thisMonthMeetings.map((m) => m.createdBy.toString())
      );
      const activeStudentsCount = thisMonthCreators.size;

      // Count active students last month
      const lastMonthCreators = new Set(
        lastMonthMeetings.map((m) => m.createdBy.toString())
      );
      const lastMonthStudentsCount = lastMonthCreators.size;

      const studentsChange =
        lastMonthStudentsCount > 0
          ? Math.round(
              ((activeStudentsCount - lastMonthStudentsCount) /
                lastMonthStudentsCount) *
                100
            )
          : 0;

      // Completion rate (based on isLive status)
      const liveCount = thisMonthMeetings.filter((m) => m.isLive).length;
      const completionRate =
        thisMonthMeetings.length > 0
          ? Math.round((liveCount / thisMonthMeetings.length) * 100)
          : 0;

      const lastMonthLiveCount = lastMonthMeetings.filter(
        (m) => m.isLive
      ).length;
      const lastMonthCompletionRate =
        lastMonthMeetings.length > 0
          ? Math.round((lastMonthLiveCount / lastMonthMeetings.length) * 100)
          : 0;

      const completionRateChange =
        completionRate - lastMonthCompletionRate;

      return res.json({
        success: true,
        data: {
          monthlyEarnings: {
            value: thisMonthEarnings,
            change: earningsChange,
          },
          sessionsThisMonth: {
            value: thisMonthSessionCount,
            change: sessionsChange,
          },
          activeStudents: {
            value: activeStudentsCount,
            change: studentsChange,
          },
          completionRate: {
            value: completionRate,
            change: completionRateChange,
          },
        },
      });
    } catch (error: any) {
      console.error("Error fetching earnings summary:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching earnings summary",
      });
    }
  }
}