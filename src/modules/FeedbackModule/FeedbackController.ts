import { Request, Response } from "express";
import FeedbackServices from "./FeedbackService";
import User from "../UserModule/models/User";
import { BadRequestError } from "../../handlers/httpError.handler";

const feedbackService = new FeedbackServices();

export default class FeedbackController {
  static async createFeedback(req: Request, res: Response) {
    const userId = req.user?.id;
    const { trainerId, rating, comment } = req.body;

    const feedback = await feedbackService.createFeedback(userId as string, {
      trainerId,
      rating,
      comment,
    });

    res.status(200).json({
      success: true,
      message: "Feedback submitted successfully",
      data: feedback,
    });
  }

  static getAllFeedback = async (req: Request, res: Response) => {
    const { search, page = 1, limit = 10, sortBy = "-createdAt" } = req.query;

    const result = await feedbackService.getAllFeedback({
      search: search as string,
      page: Number(page),
      limit: Number(limit),
      sortBy: sortBy as string,
    });

    res.status(200).json({
      success: true,
      message: "Feedbacks retrieved successfully",
      data: result,
    });
  };

  static getAllTrainerFeedback = async (req: Request, res: Response) => {
    const { search, page = 1, limit = 10, sortBy = "-createdAt" } = req.query;
    const userId = req?.user?.id;

    if (!userId) {
      throw new BadRequestError("User ID is required");
    }

    // Get current user's trainer ID
    const user = await User.findById(userId).select("trainer");
    const trainerId = user?.trainer;

    if (!trainerId) {
      throw new BadRequestError("Trainer information not found for this user");
    }

    const result = await feedbackService.getAllTrainerFeedback({
      search: search as string,
      page: Number(page),
      limit: Number(limit),
      sortBy: sortBy as string,
      trainerId: trainerId.toString(),
    });

    res.status(200).json({
      success: true,
      message: "Trainer feedbacks retrieved successfully",
      data: result,
    });
  };
}
