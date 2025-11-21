
import { Request, Response, NextFunction } from "express";
import UserService from "../services/userService";

export class UserController {
  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const payload = req.body; // dynamic

      const updatedUser = await UserService.updateUser(userId, payload);

      res.status(200).json({
        success: true,
        message: "Profile updated",
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
}
