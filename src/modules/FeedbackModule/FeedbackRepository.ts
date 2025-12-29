import RepositoryAbstract from "../../abstracts/RepositoryAbstract";
import { Feedback, IFeedback } from "./FeedbackModel";
import "../TrainerModule/TrainerModel";
import "../UserModule/models/User";
import mongoose, { Types } from "mongoose";
export interface FeedbackSearchParams {
  search?: string;
  skip: number;
  limit: number;
  sortBy?: string;
}

interface TrainerSearchParams extends FeedbackSearchParams {
  trainerId: string;
}

export default class FeedbackRepository extends RepositoryAbstract<IFeedback> {
  constructor() {
    super(Feedback, "Feedback");
  }

 async searchFeedback(params: FeedbackSearchParams & { userId?: string }) {
  const { search, skip, limit, sortBy = "-createdAt", userId } = params;

  const sortField = sortBy.startsWith("-")
    ? sortBy.substring(1)
    : sortBy;
  const sortOrder = sortBy.startsWith("-") ? -1 : 1;

  const pipeline: any[] = [];

  // ✅ Filter feedback by userId FIRST
  if (userId) {
    pipeline.push({
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  // 🔍 Search filter
  if (search) {
    pipeline.push({
      $match: {
        message: { $regex: search, $options: "i" },
      },
    });
  }

  // 👤 Lookup user details
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // 🔃 Sorting
  pipeline.push({
    $sort: { [sortField]: sortOrder },
  });

  // 📄 Pagination
  pipeline.push(
    { $skip: skip },
    { $limit: limit }
  );

  return await this.model.aggregate(pipeline);
}

}


