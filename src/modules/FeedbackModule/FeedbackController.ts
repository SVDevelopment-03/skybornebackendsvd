import { Request, Response } from "express";
import FeedbackServices from "./FeedbackService";
import User from "../UserModule/models/User";
import { BadRequestError } from "../../handlers/httpError.handler";

const feedbackService = new FeedbackServices();
export interface SubmitFeedbackRequest {
  rating: number;
  comment: string;
}

export default class FeedbackController {
  static async createFeedback(req: Request, res: Response) {
    const userId = req.user?.id;
    const { rating, comment } = req.body;

    const feedback = await feedbackService.createFeedback(userId as string, {
      rating,
      comment,
    } );

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

  static getUserFeedback = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { search, page = 1, limit = 10, sortBy = "-createdAt" } = req.query;

  const result = await feedbackService.getUserFeedback({
    userId,
    search: search as string,
    page: Number(page),
    limit: Number(limit),
    sortBy: sortBy as string,
  });

  res.status(200).json({
    success: true,
    message: "User feedbacks retrieved successfully",
    data: result,
  });
};

}

