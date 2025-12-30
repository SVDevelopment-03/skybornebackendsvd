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


interface FeedbackSearchParams {
  search?: string;
  page: number;
  limit: number;
  sortBy?: string;
}

interface TrainerSearchParams extends FeedbackSearchParams {
  trainerId: string;
}

interface FeedbackListResponse {
  data: any[];
  totalPages: number;
  totalCount: number;
  currentPage: number;
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

async getAllFeedback(params: FeedbackSearchParams): Promise<FeedbackListResponse> {
    const { page, limit, search, sortBy } = params;
    const skip = (page - 1) * limit;

    // Get total count
    const totalCount = await _feedbackRepo.countFeedback({ search });

    // Get paginated data
    const data = await _feedbackRepo.searchFeedback({
      search,
      skip,
      limit,
      sortBy,
    });

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      totalPages,
      totalCount,
      currentPage: page,
    };
  }

  async getUserFeedback(
    params: FeedbackSearchParams & { userId: string }
  ): Promise<FeedbackListResponse> {
    const { page, limit, search, sortBy, userId } = params;
    const skip = (page - 1) * limit;

    // Get total count for this user
    const totalCount = await _feedbackRepo.countFeedback({ search, userId });

    // Get paginated data
    const data = await _feedbackRepo.searchFeedback({
      search,
      skip,
      limit,
      sortBy,
      userId,
    });

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      totalPages,
      totalCount,
      currentPage: page,
    };
  }
}




