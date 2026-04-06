import { Request, Response, NextFunction } from "express";
import UserService from "../services/userService";
import User from "../models/User";
import MeetingAttendance from "../../MeetingModule/MeetingModels/MeetingAttendance";
import Meeting from "../../MeetingModule/MeetingModels/Meeting";
import extractPhoneDetails from "../../../utils/extractPhoneDetail";
import { getCode, getName } from "country-list";
import CancelSubscriptionModel from "../../CancelSubscriptionModule/CancelSubscriptionModel";
import { PushNotificationService } from "../../../services/pushNotification.service";

const userService = new UserService();

export class UserController {
  private static async attachCancelledAtFromCancellationRequests(users: any[]) {
    if (!users.length) return users;

    const emails = Array.from(
      new Set(
        users
          .map((user: any) => String(user?.email || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    if (!emails.length) return users;

    const cancelledRequests = await CancelSubscriptionModel.find({
      email: { $in: emails },
      status: "cancelled",
      cancelledAt: { $ne: null },
    })
      .select("email cancelledAt createdAt")
      .sort({ cancelledAt: -1, createdAt: -1 })
      .lean();

    const cancelledAtByEmail = new Map<string, Date>();

    for (const request of cancelledRequests) {
      const emailKey = String((request as any)?.email || "")
        .trim()
        .toLowerCase();
      const cancelledAt = (request as any)?.cancelledAt;
      if (!emailKey || cancelledAtByEmail.has(emailKey) || !cancelledAt)
        continue;

      cancelledAtByEmail.set(emailKey, cancelledAt);
    }

    return users.map((user: any) => {
      const emailKey = String(user?.email || "").trim().toLowerCase();
      const cancelledAt = cancelledAtByEmail.get(emailKey) || null;
      return { ...user, cancelledAt };
    });
  }

  // Original pagination endpoint
  static async getAll(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const country = (req.query.country as string) || "";
      const state = (req.query.state as string) || "";
      const plan = (req.query.plan as string) || "";
      const filter = (req.query.filter as string) || "";

      const skip = (page - 1) * limit;

      // Build query object
      const query: any = { role: "user" };
      query.onboardingCompleted = true;

      // Filter by country code
      if (country && country !== "all") {
        query.countryCode = country.toUpperCase();
      }

      // Filter by state
      if (state && state.toLowerCase() !== "all") {
        const escapedState = state.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.state = { $regex: `^${escapedState}$`, $options: "i" };
      }

      // Filter by plan
      if (plan && plan !== "all") {
        query.plan = plan;
      }

      // Build search query
      let finalQuery = query;

      if (search) {
        const searchLower = search.toLowerCase();
        finalQuery = {
          ...query,
          $or: [
            { firstName: { $regex: searchLower, $options: "i" } },
            { lastName: { $regex: searchLower, $options: "i" } },
            { email: { $regex: searchLower, $options: "i" } },
            { phoneNumber: { $regex: searchLower, $options: "i" } },
          ],
        };
      }

      // Fetch users with applied filters
      const users = await User.find(finalQuery)
        .select(
          "_id firstName lastName email phoneNumber country countryCode state plan subscription isActive createdAt",
        )
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

      const usersWithCancelledAt =
        await UserController.attachCancelledAtFromCancellationRequests(users);

      // Get total count for pagination
      const total = await User.countDocuments(finalQuery);

      return res.status(200).json({
        success: true,
        message: "Users fetched successfully",
        data: {
          users: usersWithCancelledAt,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            total,
            limit,
          },
        },
      });
    } catch (error) {
      console.error("❌ Error fetching users:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch users",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // =======================================
  // NEW: GET ALL USERS FOR EXPORT (NO PAGINATION)
  // =======================================
  // =======================================
  // EXPORT USERS AS CSV
  // =======================================
  static async exportUsersCSV(req: Request, res: Response) {
    try {
      const search = (req.query.search as string) || "";
      const country = (req.query.country as string) || "";
      const plan = (req.query.plan as string) || "";

      // Build query object
      const query: any = { role: "user" };
      query.onboardingCompleted = true;

      // Filter by country code
      if (country && country !== "all") {
        query.countryCode = country.toUpperCase();
      }

      // Filter by plan
      if (plan && plan !== "all") {
        query.plan = plan;
      }

      // Build search query
      let finalQuery = query;

      if (search) {
        const searchLower = search.toLowerCase();
        finalQuery = {
          ...query,
          $or: [
            { firstName: { $regex: searchLower, $options: "i" } },
            { lastName: { $regex: searchLower, $options: "i" } },
            { email: { $regex: searchLower, $options: "i" } },
            { phoneNumber: { $regex: searchLower, $options: "i" } },
          ],
        };
      }

      // Fetch ALL users with applied filters
      const users = await User.find(finalQuery)
        .select(
          "_id firstName lastName email phoneNumber country countryCode state city plan subscription isActive createdAt",
        )
        .sort({ createdAt: -1 })
        .lean();

      const usersWithCancelledAt =
        await UserController.attachCancelledAtFromCancellationRequests(users);

      // Generate CSV
      const headers = [
        "Name",
        "Email",
        "Phone",
        "Country",
        "State",
        "City",
        "Plan",
        "Subscription Status",
        "Cancelled At",
        "Status",
        "Created Date",
      ];

      const formatDate = (dateValue: any) => {
        if (!dateValue) return "N/A";
        const parsedDate = new Date(dateValue);
        if (Number.isNaN(parsedDate.getTime())) return "N/A";

        return parsedDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      };

      const rows = usersWithCancelledAt.map((user: any) => {
        const name =
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A";
        const email = user?.email || "N/A";
        const phone = user?.phoneNumber || "N/A";
        const country = user?.country || user?.countryCode || "N/A";
        const state = user?.state || "N/A";
        const city = user?.city || "N/A";
        const plan = user.plan || "N/A";
        const subscriptionStatus = user?.subscription?.status || "N/A";
        const cancelledAt = formatDate(user?.cancelledAt);
        const status = user.isActive ? "Active" : "Inactive";
        const createdDate = formatDate(user.createdAt);

        return [
          name,
          email,
          phone,
          country,
          state,
          city,
          plan,
          subscriptionStatus,
          cancelledAt,
          status,
          createdDate,
        ];
      });

      // Escape CSV values
      const escapeCSV = (value: string): string => {
        const escaped = String(value).replace(/"/g, '""');
        return escaped.includes(",") ||
          escaped.includes('"') ||
          escaped.includes("\n")
          ? `"${escaped}"`
          : escaped;
      };

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      // Set headers for file download
      const filename = `users_${new Date().toISOString().split("T")[0]}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      return res.status(200).send(csvContent);
    } catch (error) {
      console.error("❌ Error exporting users CSV:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to export users CSV",
        error: error instanceof Error ? error.message : "Unknown error",
      });
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

      // 1. Count Upcoming Sessions
      const upcomingSessions = await Meeting.countDocuments({
        localTime: { $gte: now },
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

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
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
        "phone",
        "country",
        "email", 
        "state",
        "city",
        "status",
      ];

      // Filter payload to only include allowed fields
      const updateData: any = {};
      allowedFields.forEach((field) => {
        if (payload[field] !== undefined) {
          if (field === "phone") {
            // Extract phone details
            const { dialingCode, localNumber, countryCode, country } =
              extractPhoneDetails(payload.phone);

            updateData.phoneNumber = payload.phone;     
            updateData.dialingCode = dialingCode;       
            updateData.localNumber = localNumber;     
            updateData.countryCode = countryCode;     
            updateData.country = country;             
          } else if (field === "country") {
            const rawCountry = String(payload.country || "").trim();
            if (rawCountry) {
              const isIsoCode = /^[a-z]{2}$/i.test(rawCountry);
              const normalizedCode = isIsoCode
                ? rawCountry.toUpperCase()
                : getCode(rawCountry) || "";
              const normalizedName = isIsoCode
                ? getName(rawCountry.toUpperCase()) || rawCountry
                : rawCountry;

              updateData.country = normalizedName;
              if (normalizedCode) {
                updateData.countryCode = normalizedCode;
              }
            } else {
              updateData.country = rawCountry;
            }
          } else {
            updateData[field] = payload[field];
          }
        }
      });

      // Prevent email from being updated
      if (payload.email) {
        updateData.email = payload.email;
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

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || (req.user as any)?._id;
      const { newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!newPassword || typeof newPassword !== "string") {
        return res.status(400).json({
          success: false,
          message: "New password is required",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
        });
      }

      const user = await User.findById(userId).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.password = newPassword;
      await user.save();

      PushNotificationService.sendPasswordChanged(String(user._id)).catch((error: any) => {
        console.error("❌ Failed to send password-changed push notification:", error?.message || error);
      });

      return res.status(200).json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error: any) {
      console.error("Error changing password:", error);
      next(error);
    }
  }

  static async updateUserStatus(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      // Validate status
      const allowedStatuses = ["active", "inactive", "blocked"];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        });
      }

      // Map status → isActive (since schema uses isActive)
      const updatePayload: any = {
        isActive: status === "active",
      };

      // Optional: store blocked users logic
      if (status === "blocked") {
        updatePayload.isActive = false;
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updatePayload },
        { new: true },
      ).select("-password");

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "User status updated successfully",
        data: updatedUser,
      });
    } catch (error: any) {
      console.error("Error updating user status:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update user status",
      });
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
