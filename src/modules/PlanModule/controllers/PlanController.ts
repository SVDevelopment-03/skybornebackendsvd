import { Request, Response } from "express";
import PlanServices from "../services/PlanService";

const planService = new PlanServices();

export default class PlanController {
  static async getAllPlans(req: Request, res: Response) {
    const plans = await planService.getAllPlans({});
    return res.status(200).json({
      success: true,
      message: "Plans fetched successfully",
      data: plans,
    });
  }
}
