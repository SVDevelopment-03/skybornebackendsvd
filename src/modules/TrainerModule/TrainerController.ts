import { Request, Response } from "express";
import CoachServices from "./TrainerServices";

const faqservice = new CoachServices();

export default class CoachController {
  static async getAll(req: Request, res: Response) {
    const services = await faqservice.getAll({});
    return res.status(200).json({
      success: true,
      message: "faq fetched successfully",
      data: services,
    });
  }
}
