import { Request, Response, NextFunction } from "express";

export const apiTimeout = (ms: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set timeout
    res.setTimeout(ms, () => {
      return res.status(503).json({
        success: false,
        message: `Request timeout: exceeded ${ms / 1000} seconds`,
      });
    });

    next();
  };
};
