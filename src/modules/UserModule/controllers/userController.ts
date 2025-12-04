
import { Request, Response, NextFunction } from "express";
import UserService from "../services/userService";
import User from "../models/User";

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

   static async me(req: Request, res: Response) {  
      const userId = req?.user && req?.user?.id;
  
      const user = await User.findById(userId).select("-password");
  
      if (!user) return res.status(404).json({ message: "User not found" });
  
      res.json({ user });
    }
}
