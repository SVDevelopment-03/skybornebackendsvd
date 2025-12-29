import RepositoryAbstract from "../../abstracts/RepositoryAbstract";
import { Feedback, IFeedback } from "./FeedbackModel";
import "../TrainerModule/TrainerModel";
import "../UserModule/models/User";
import { Types } from "mongoose";
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

async searchFeedback(params: FeedbackSearchParams) {
  const { search, skip, limit, sortBy = "-createdAt" } = params;

  const sortField = sortBy.startsWith("-")
    ? sortBy.substring(1)
    : sortBy;
  const sortOrder = sortBy.startsWith("-") ? -1 : 1;

  const pipeline: any[] = [];

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

  if (search) {
    const regex = new RegExp(search, "i");

    pipeline.push({
      $match: {
        $or: [
          { "user.firstName": regex },
          { "user.lastName": regex },
          { "user.email": regex },
          { "trainer.name": regex },
          { "trainer.email": regex },
          { comment: regex },
        ],
      },
    });
  }


  const countPipeline = [...pipeline, { $count: "total" }];
  const countResult = await this.model.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  pipeline.push(
    { $sort: { [sortField]: sortOrder } },
    { $skip: skip },
    { $limit: limit }
  );


  const feedbacks = await this.model.aggregate(pipeline);

  return {
    feedbacks: feedbacks.map((fb: any) => ({
      _id: fb._id,
      session: "Session",
      trainer: {
        name: fb.trainer?.name || "Unknown",
        email: fb.trainer?.email || "Unknown",
      },
      userName:
        fb.user?.firstName && fb.user?.lastName
          ? `${fb.user.firstName} ${fb.user.lastName}`
          : "Unknown",
      userEmail: fb.user?.email || "Unknown",
      date: new Date(fb.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      rating: fb.rating,
      comment: fb.comment,
      status: "submitted",
      trainerResponse: null,
      createdAt: fb.createdAt,
    })),
    total,
    page: Math.floor(skip / limit) + 1,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

 async searchTrainerFeedback(params: TrainerSearchParams) {
    const { search, skip, limit, sortBy = "-createdAt", trainerId } = params;

    // Validate trainerId
    if (!trainerId || !Types.ObjectId.isValid(trainerId)) {
      throw new Error("Invalid trainer ID");
    }

    const trainerObjectId = new Types.ObjectId(trainerId);
    const sortField = sortBy.startsWith("-")
      ? sortBy.substring(1)
      : sortBy;
    const sortOrder = sortBy.startsWith("-") ? -1 : 1;

    const pipeline: any[] = [];

    // Filter by trainer ID first
    pipeline.push({
      $match: {
        trainerId: trainerObjectId,
      },
    });

    // Lookup user details
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

    // Lookup trainer details
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

    // Project required fields
    pipeline.push({
      $project: {
        _id: 1,
        userId: 1,
        trainerId: 1,
        rating: 1,
        comment: 1,
        status: 1,
        trainerResponse: 1,
        createdAt: 1,
        sessionId: 1,
        "user.firstName": 1,
        "user.lastName": 1,
        "user.email": 1,
        "trainer._id": 1,
        "trainer.name": 1,
        "trainer.email": 1,
      },
    });

    // Apply search filter
    if (search) {
      const regex = new RegExp(search, "i");

      pipeline.push({
        $match: {
          $or: [
            { "user.firstName": regex },
            { "user.lastName": regex },
            { "user.email": regex },
            { comment: regex },
          ],
        },
      });
    }

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await this.model.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Add sort, skip, and limit
    pipeline.push(
      { $sort: { [sortField]: sortOrder } },
      { $skip: skip },
      { $limit: limit }
    );

    const feedbacks = await this.model.aggregate(pipeline);

    return {
      feedbacks: feedbacks.map((fb: any) => ({
        _id: fb._id,
        session: fb.sessionId || "Session",
        trainer: {
          _id: fb.trainer?._id || "",
          name: fb.trainer?.name || "Unknown",
          email: fb.trainer?.email || "Unknown",
        },
        userName:
          fb.user?.firstName && fb.user?.lastName
            ? `${fb.user.firstName} ${fb.user.lastName}`
            : "Unknown",
        userEmail: fb.user?.email || "Unknown",
        date: new Date(fb.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        rating: fb.rating,
        comment: fb.comment,
        status: fb.status || "submitted",
        trainerResponse: fb.trainerResponse || null,
        createdAt: fb.createdAt,
      })),
      total,
      page: Math.floor(skip / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

