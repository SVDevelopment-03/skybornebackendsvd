import type {Request, Response, NextFunction } from "express";
import { AuthRequest } from "./verifyToken.middleware";  // your file

// roles example: ["admin", "manager"]
export const allowRoles = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have access",
      });
    }

    next();
  };
};
