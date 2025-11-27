import { Request, Response } from "express";
import TestimonialServices from "../services/TestimonialService";

const testimonialService = new TestimonialServices();

export default class TestimonialController {
  static async getAllPlans(req: Request, res: Response) {
    const plans = await testimonialService.getAllPlans({});
    return res.status(200).json({
      success: true,
      message: "Testimonials fetched successfully",
      data: plans,
    });
  }
}
