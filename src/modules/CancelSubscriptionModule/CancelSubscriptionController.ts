import { Request, Response } from "express";
import CancelSubscriptionModel from "./CancelSubscriptionModel";
import User from "../UserModule/models/User"; 

class CancelSubscriptionController {
  // 1️⃣ GET: Fetch all cancel subscriptions with pagination
  static async getAll(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const filter = (req.query.filter as string) || "";

      const skip = (page - 1) * limit;

      // Build query object
      const query: any = {};

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
            { userId: { $regex: searchLower, $options: "i" } },
          ],
        };
      }

      // Apply filter if needed
      if (filter === "cancelled") {
        finalQuery.isCancelled = true;
      } else if (filter === "pending") {
        finalQuery.isCancelled = false;
      }

      // Fetch cancel subscriptions with applied filters
      const cancelSubscriptions = await CancelSubscriptionModel.find(finalQuery)
        .select(
          "_id subscriptionId firstName lastName email userId isCancelled description createdAt"
        )
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

      // Get total count for pagination
      const total = await CancelSubscriptionModel.countDocuments(finalQuery);

      return res.status(200).json({
        success: true,
        message: "Cancel subscriptions fetched successfully",
        data: {
          cancelSubscriptions,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            total,
            limit,
          },
        },
      });
    } catch (error) {
      console.error("❌ Error fetching cancel subscriptions:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch cancel subscriptions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // 2️⃣ POST: Create a new cancel subscription request
  static async create(req: Request, res: Response) {
    try {
      const { userId, description } = req.body;

      // Validate required fields
      if (!userId || !description) {
        return res.status(400).json({
          success: false,
          message: "userId and description are required",
        });
      }

      // Find user by userId
      const user = await User.findById(userId).select(
        "_id firstName lastName email stripeSubscriptionId"
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if subscription already exists for this user
      const existingCancellation = await CancelSubscriptionModel.findOne({
        userId,
        isCancelled: false,
      });

      if (existingCancellation) {
        return res.status(400).json({
          success: false,
          message: "Cancel subscription request already exists for this user",
        });
      }

      // Generate subscriptionId (can be customized as per your needs)
      const subscriptionId = `SUB-${userId}-${Date.now()}`;

      // Create new cancel subscription record
      const newCancelSubscription = await CancelSubscriptionModel.create({
        subscriptionId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userId,
        description: description || "",
        isCancelled: false,
      });

      return res.status(201).json({
        success: true,
        message: "Cancel subscription request created successfully",
        data: newCancelSubscription,
      });
    } catch (error) {
      console.error("❌ Error creating cancel subscription:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create cancel subscription request",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export default CancelSubscriptionController;