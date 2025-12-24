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

      // Get trainer ID from user ✅ KEY FIX
      const trainerId = await TrainerController.getTrainerIdFromUser(userId);
      console.log("trainer id", trainerId);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Sessions this month
      const sessionsThisMonth = await Meeting.countDocuments({
        trainer: new Types.ObjectId(trainerId),
        localTime: { $gte: monthStart, $lte: monthEnd },
      });

      // Previous month sessions for comparison
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const sessionsLastMonth = await Meeting.countDocuments({
        trainer: new Types.ObjectId(trainerId),
        localTime: { $gte: prevMonthStart, $lte: prevMonthEnd },
      });

      console.log("month", sessionsThisMonth);

      const sessionsChange =
        sessionsLastMonth > 0
          ? Math.round(
              ((sessionsThisMonth - sessionsLastMonth) / sessionsLastMonth) *
                100
            )
          : 0;

      // Monthly earnings from attendance
      const attendanceData = await MeetingAttendance.aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart, $lte: monthEnd },
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
      ]);

      // Calculate earnings (assuming $10 per attendance)
      const monthlyEarnings = attendanceData.length * 1000; // in cents

      // Previous month earnings
      const prevMonthAttendance = await MeetingAttendance.aggregate([
        {
          $match: {
            createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
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
      ]);

      const prevMonthEarnings = prevMonthAttendance.length * 1000;
      const earningsChange =
        prevMonthEarnings > 0
          ? Math.round(
              ((monthlyEarnings - prevMonthEarnings) / prevMonthEarnings) * 100
            )
          : 0;

      // Active students (unique users who attended this month)
      const activeStudents = await MeetingAttendance.aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart, $lte: monthEnd },
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
            _id: "$user",
          },
        },
      ]);

      const activeStudentsCount = activeStudents.length;

      // Previous month active students
      const prevActiveStudents = await MeetingAttendance.aggregate([
        {
          $match: {
            createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
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
            _id: "$user",
          },
        },
      ]);

      const prevActiveStudentsCount = prevActiveStudents.length;
      const studentsChange =
        prevActiveStudentsCount > 0
          ? Math.round(
              ((activeStudentsCount - prevActiveStudentsCount) /
                prevActiveStudentsCount) *
                100
            )
          : 0;

      // Completion rate
      const totalAttendance = await MeetingAttendance.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
      });

      const completedAttendance = await MeetingAttendance.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
        status: "completed",
      });

      const completionRate =
        totalAttendance > 0
          ? Math.round((completedAttendance / totalAttendance) * 100)
          : 0;

      // Previous completion rate
      const prevTotalAttendance = await MeetingAttendance.countDocuments({
        createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
      });

      const prevCompletedAttendance = await MeetingAttendance.countDocuments({
        createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
        status: "completed",
      });

      const prevCompletionRate =
        prevTotalAttendance > 0
          ? Math.round((prevCompletedAttendance / prevTotalAttendance) * 100)
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
            value: monthlyEarnings,
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

      // Get sessions by trainer and attendance rate
      const meetings = await Meeting.find({
        trainer: new Types.ObjectId(trainerId),
        localTime: { $gte: periodAgo },
      }).select("_id title");

      const attendanceRates = await Promise.all(
        meetings.map(async (meeting) => {
          const totalRegistered = await MeetingAttendance.countDocuments({
            meeting: meeting._id,
            status: { $in: ["registered", "joined", "completed"] },
          });

          const attended = await MeetingAttendance.countDocuments({
            meeting: meeting._id,
            status: { $in: ["joined", "completed"] },
          });

          const rate =
            totalRegistered > 0
              ? Math.round((attended / totalRegistered) * 100)
              : 0;

          return {
            title: meeting.title,
            rate,
          };
        })
      );

      const labels = attendanceRates.map((r) => r.title);
      const values = attendanceRates.map((r) => r.rate);

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        success: true,
        data: {
          labels,
          values,
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
}