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

async countFeedback(params: { 
  search?: string; 
  userId?: string;
  trainerId?: string;
}): Promise<number> {
  const { search, userId, trainerId } = params;

  const pipeline: any[] = [];

  // First match stage - only filter by userId/trainerId (not search)
  const firstMatch: any = {};
  if (userId && Types.ObjectId.isValid(userId)) {
    firstMatch.userId = new Types.ObjectId(userId);
  }
  if (trainerId && Types.ObjectId.isValid(trainerId)) {
    firstMatch.trainerId = new Types.ObjectId(trainerId);
  }
  
  if (Object.keys(firstMatch).length > 0) {
    pipeline.push({ $match: firstMatch });
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

  // 🏆 Lookup trainer (coach) details
  pipeline.push(
    {
      $lookup: {
        from: "coaches",
        localField: "trainerId",
        foreignField: "_id",
        as: "trainer",
      },
    },
    {
      $unwind: {
        path: "$trainer",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // Add addFields to create concatenated full name field for easier searching
  pipeline.push({
    $addFields: {
      userFullName: {
        $trim: {
          input: {
            $concat: [
              { $ifNull: ["$user.firstName", ""] },
              " ",
              { $ifNull: ["$user.lastName", ""] },
            ],
          },
        },
      },
    },
  });

  // Add match for search (after lookups and field creation)
  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { comment: { $regex: search, $options: "i" } },
          { userFullName: { $regex: search, $options: "i" } },
          { "user.email": { $regex: search, $options: "i" } },
          { "trainer.name": { $regex: search, $options: "i" } },
          { "trainer.email": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  // Count the results
  pipeline.push({ $count: "total" });

  const result = await this.model.aggregate(pipeline);
  return result[0]?.total || 0;
}

async searchFeedback(params: {
  search?: string;
  skip: number;
  limit: number;
  sortBy?: string;
  userId?: string;
  trainerId?: string;
}): Promise<any[]> {
  const { search, skip, limit, sortBy = "-createdAt", userId, trainerId } = params;

  const sortField = sortBy.startsWith("-") ? sortBy.substring(1) : sortBy;
  const sortOrder = sortBy.startsWith("-") ? -1 : 1;

  const pipeline: any[] = [];

  // First match stage - only filter by userId/trainerId (not search)
  const firstMatch: any = {};
  if (userId && Types.ObjectId.isValid(userId)) {
    firstMatch.userId = new Types.ObjectId(userId);
  }
  if (trainerId && Types.ObjectId.isValid(trainerId)) {
    firstMatch.trainerId = new Types.ObjectId(trainerId);
  }
  
  if (Object.keys(firstMatch).length > 0) {
    pipeline.push({ $match: firstMatch });
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

  // 🏆 Lookup trainer (coach) details
  pipeline.push(
    {
      $lookup: {
        from: "coaches",
        localField: "trainerId",
        foreignField: "_id",
        as: "trainer",
      },
    },
    {
      $unwind: {
        path: "$trainer",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // 📚 Lookup session details (optional)
  pipeline.push(
    {
      $lookup: {
        from: "sessions",
        localField: "sessionId",
        foreignField: "_id",
        as: "session",
      },
    },
    {
      $unwind: {
        path: "$session",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // Add addFields to create concatenated full name field for easier searching
  pipeline.push({
    $addFields: {
      userFullName: {
        $trim: {
          input: {
            $concat: [
              { $ifNull: ["$user.firstName", ""] },
              " ",
              { $ifNull: ["$user.lastName", ""] },
            ],
          },
        },
      },
    },
  });

  // Add match for search (after lookups and field creation)
  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { comment: { $regex: search, $options: "i" } },
          { userFullName: { $regex: search, $options: "i" } },
          { "user.email": { $regex: search, $options: "i" } },
          { "trainer.name": { $regex: search, $options: "i" } },
          { "trainer.email": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  // Project to format response with concatenated name
  pipeline.push({
    $project: {
      _id: 1,
      userId: 1,
      trainerId: 1,
      sessionId: 1,
      rating: 1,
      comment: 1,
      status: 1,
      trainerResponse: 1,
      createdAt: 1,
      updatedAt: 1,
      user: {
        _id: "$user._id",
        name: {
          $concat: [
            { $ifNull: ["$user.firstName", ""] },
            " ",
            { $ifNull: ["$user.lastName", ""] },
          ],
        },
        email: "$user.email",
      },
      trainer: {
        _id: "$trainer._id",
        name: "$trainer.name",
        email: "$trainer.email",
      },
      session: {
        _id: "$session._id",
        title: { $ifNull: ["$session.title", "N/A"] },
      },
    },
  });

  // Add sorting and pagination
  pipeline.push(
    { $sort: { [sortField]: sortOrder } },
    { $skip: skip },
    { $limit: limit }
  );

  return await this.model.aggregate(pipeline);
}

}