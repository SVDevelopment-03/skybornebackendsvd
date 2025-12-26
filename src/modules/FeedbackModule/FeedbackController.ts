import { Request, Response } from "express";
import FeedbackServices from "./FeedbackService";

const feedbackService = new FeedbackServices();

export default class FeedbackController {
 static async createFeedback(
    req: Request,
    res: Response,
  ) {
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
}
