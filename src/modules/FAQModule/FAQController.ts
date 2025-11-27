import { Request, Response } from "express";
import FAQServices from "./FAQService";

const faqservice = new FAQServices();

export default class FAQController {
  static async getAll(req: Request, res: Response) {
    const services = await faqservice.getAll({});
    return res.status(200).json({
      success: true,
      message: "faq fetched successfully",
      data: services,
    });
  }
}
