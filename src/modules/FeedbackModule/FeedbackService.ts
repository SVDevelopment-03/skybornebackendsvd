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

    const trainerObjectId = new Types.ObjectId(payload.trainerId);
    const userObjectId = new Types.ObjectId(userId);

    const trainerExists = await _trainerRepo.getOneModel(payload.trainerId);

    if (!trainerExists) {
      throw new NotFoundError("Trainer not found");
    }

    const existingFeedback = await _feedbackRepo.searchModel({
      userId: userObjectId,
      trainerId: trainerObjectId,
    });

    if (existingFeedback) {
      throw new ConflictError(
        "You have already submitted feedback for this trainer"
      );
    }

    const feedbackData = {
      userId: userObjectId,
      trainerId: trainerObjectId,
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



 async getAllTrainerFeedback(params: TrainerSearchParams) {
    const { page, limit, search, sortBy, trainerId } = params;

    // Validate trainerId exists
    if (!trainerId) {
      throw new NotFoundError("Trainer ID is required");
    }

    const skip = (page - 1) * limit;

    return await _feedbackRepo.searchTrainerFeedback({
      search,
      skip,
      limit,
      sortBy,
      trainerId,
    });
  }

}

