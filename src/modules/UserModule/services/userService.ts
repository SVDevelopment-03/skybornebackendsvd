/* eslint-disable @typescript-eslint/no-explicit-any */

import User from "../../UserModule/models/User";
import { NotFoundError } from "../../../handlers/httpError.handler";
import UserRepository from "../UserRepo";
import { FilterQuery } from "mongoose";

const _userRepo = new UserRepository();

export default class UserService {
  static async updateUser(userId: string, payload: Record<string, any>) {
    try {
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId },
        { $set: payload },
        { new: true }
      ).orFail(() => new NotFoundError("User not found"));

      return updatedUser;
    } catch (err: any) {
      // optional custom error handler
      throw new NotFoundError(err.message || "Failed to update user");
    }
  }

  async getAll(payload: {
    search?: string;
    skip: number;
    limit: number;
    filter: string;
  }) {
    const { search, skip, limit } = payload;

    const query: FilterQuery<any> = {};

    if (search) {
      const regex = new RegExp(search, "i");

      query.$or = [
        // email search
        { email: { $regex: regex } },

        // firstName OR lastName
        { firstName: { $regex: regex } },
        { lastName: { $regex: regex } },

        // full name search: "firstName lastName"
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: search,
              options: "i",
            },
          },
        },
      ];
    }

    const users = await User.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await User.countDocuments(query);

    return { users, total };
  }
}
