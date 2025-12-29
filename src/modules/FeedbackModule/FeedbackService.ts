import { ConflictError, NotFoundError } from "../../handlers/httpError.handler";
import TrainerRepository from "../TrainerModule/TrainerRepository";
import FeedbackRepository from "./FeedbackRepository";
import { SubmitFeedbackRequest } from "./FeedbackTypes";
import { Types } from "mongoose";


const _feedbackRepo = new FeedbackRepository();
const _trainerRepo = new TrainerRepository();

interface FeedbackSearchParams {
  search?: string;
  page: number;
  limit: number;
  sortBy?: string;
}
interface TrainerSearchParams extends FeedbackSearchParams {
  trainerId: string;
}


export default class FeedbackServices {
  async createFeedback(userId: string, payload: SubmitFeedbackRequest) {
    // Validate userId
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new NotFoundError("Invalid user ID");
    }

    const userObjectId = new Types.ObjectId(userId);

    const feedbackData = {
      userId: userObjectId,
      rating: payload.rating,
      comment: payload.comment,
    };

    return await _feedbackRepo.createModel(feedbackData);
  }

  async getAllFeedback(params: FeedbackSearchParams) {
    const { page, limit, search, sortBy } = params;
    const skip = (page - 1) * limit;

    return await _feedbackRepo.searchFeedback({
      search,
      skip,
      limit,
      sortBy,
    });
  }

  async getUserFeedback(params: FeedbackSearchParams & { userId: string }) {
  const { page, limit, search, sortBy, userId } = params;
  const skip = (page - 1) * limit;

  return await _feedbackRepo.searchFeedback({
    search,
    skip,
    limit,
    sortBy,
    userId,
  });
}

}

