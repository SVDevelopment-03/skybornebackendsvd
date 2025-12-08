
import { Request, Response, NextFunction } from "express";
import UserService from "../services/userService";
import User from "../models/User";
import MeetingAttendance from "../../MeetingModule/MeetingModels/MeetingAttendance";
import Service from "../../ServiceModule/models/Service";
import Meeting from "../../MeetingModule/MeetingModels/Meeting";

export class UserController {
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
    const user = await User.findById(userId).select(
      "plan classCredits"
    );

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
      title: { $in: serviceTitles } 
    }).select("_id");
    
    const serviceIds = services.map(service => service._id);

    // 1. Count Upcoming Sessions (same filter as GetUpcomingMeetings)
    const upcomingSessions = await Meeting.countDocuments({
      localTime: { $gte: oneHourAgo },
      service: { $in: serviceIds },
    });

    // 2. Get Total Credits
    const totalCredits =
      (user.classCredits?.yoga || 0) +
      (user.classCredits?.zumba || 0) +
      (user.classCredits?.specialty || 0);

    // 3. Count Classes Attended (status: "joined" or "completed")
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




  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const payload = req.body; // dynamic

      const updatedUser = await UserService.updateUser(userId, payload);

      res.status(200).json({
        success: true,
        message: "Profile updated",
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

   static async me(req: Request, res: Response) {  
      const userId = req?.user && req?.user?.id;
  
      const user = await User.findById(userId).select("-password");
  
      if (!user) return res.status(404).json({ message: "User not found" });
  
      res.json({ user });
    }
}


// Helper function to get display name for plans
function getPlanDisplayName(plan: string | undefined): string {
  console.log("checking....");
  
  const planMap: { [key: string]: string } = {
    "gold-yoga": "Gold Yoga",
    "gold-zumba": "Gold Zumba",
    "gold-mixed": "Gold Mixed",
    diamond: "Diamond",
    platinum: "Platinum",
  };
  return planMap[plan || ""] || "No Plan";
}   