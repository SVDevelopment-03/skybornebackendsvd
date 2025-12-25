/* eslint-disable @typescript-eslint/no-explicit-any */

import User from "../../UserModule/models/User";
import { NotFoundError } from "../../../handlers/httpError.handler";
import UserRepository from "../UserRepo";

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
    filter:string
  }) {
    const users = await _userRepo.searchModels(payload);
    const total = await _userRepo.countDocuments(
      payload.search
        ? {
            $or: [
              { name: { $regex: payload.search, $options: "i" } },
              { email: { $regex: payload.search, $options: "i" } },
            ],
          }
        : {}
    );
    return { users, total };
  }
}

 