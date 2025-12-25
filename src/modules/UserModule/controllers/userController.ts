import { Request, Response, NextFunction } from "express";
import UserService from "../services/userService";
import User from "../models/User";
import MeetingAttendance from "../../MeetingModule/MeetingModels/MeetingAttendance";
import Service from "../../ServiceModule/models/Service";
import Meeting from "../../MeetingModule/MeetingModels/Meeting";

const userService = new UserService();

export class UserController {
static async getAll(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const filter = (req.query.filter as string) || "";

      const skip = (page - 1) * limit;

      const result = await userService.getAll({
        search,
        skip,
        limit,
        filter,
      });

      return res.status(200).json({
        success: true,
        message: "Users fetched successfully",
        data: result.users,
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


  static async GetDashboardStats(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Fetch user data
      const user = await User.findById(userId).select("plan classCredits");

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
        serviceTitles = ["Yoga", "Zumba Dance", "Diet & Nutrition"];
      }

      // Fetch service IDs based on titles
      const services = await Service.find({
        title: { $in: serviceTitles },
      }).select("_id");

      const serviceIds = services.map((service) => service._id);

      // 1. Count Upcoming Sessions
      const upcomingSessions = await Meeting.countDocuments({
        localTime: { $gte: oneHourAgo },
        service: { $in: serviceIds },
      });

      // 2. Get Total Credits
      const totalCredits =
        (Number(user.classCredits?.yoga) || 0) +
        (Number(user.classCredits?.zumba) || 0) +
        (Number(user.classCredits?.specialty) || 0);

      // 3. Count Classes Attended
      const classesAttended = await MeetingAttendance.countDocuments({
        user: userId,
        status: { $in: ["joined", "completed"] },
      });

      // 4. Get Current Plan
      const planDetails = {
        plan: user.plan || "Not Selected",
        displayName: getPlanDisplayName(user.plan),
      };

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        success: true,
        data: {
          upcomingSessions,
          totalCredits,
          classesAttended,
          currentPlan: planDetails,
        },
      });
    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching dashboard statistics",
      });
    }
  }

  static async me(req: Request, res: Response) {
    try {
      const userId = req?.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const user = await User.findById(userId).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        user,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching user profile",
      });
    }
  }

  static async updateProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = (req as any).user?.id;
      const payload = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Allowed fields for update
      const allowedFields = [
        "firstName",
        "lastName",
        "phoneNumber",
        "country",
      ];

      // Filter payload to only include allowed fields
      const updateData: any = {};
      allowedFields.forEach((field) => {
        if (payload[field] !== undefined) {
          // Map 'phone' from frontend to 'phoneNumber' in backend
          const dbField = field === "phone" ? "phoneNumber" : field;
          updateData[dbField] = payload[field];
        }
      });

      // Prevent email from being updated
      if (payload.email) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be changed",
        });
      }

      // Prevent password from being updated via this endpoint
      if (payload.password) {
        return res.status(400).json({
          success: false,
          message: "Use the password reset endpoint to change password",
        });
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      next(error);
    }
  }
}

// Helper function to get display name for plans
function getPlanDisplayName(plan: string | undefined): string {
  const planMap: { [key: string]: string } = {
    "gold-yoga": "Gold Yoga",
    "gold-zumba": "Gold Zumba",
    "gold-mixed": "Gold Mixed",
    diamond: "Diamond",
    platinum: "Platinum",
  };
  return planMap[plan || ""] || "No Plan";
}