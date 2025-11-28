// src/modules/ConsultationModule/controllers/consultationController.ts

import { Request, Response } from "express";
import Consultation from "./ConsultationModel";

export class ConsultationController {
  static async createConsultation(req: Request, res: Response) {
    const newConsultation = await Consultation.create(req?.body);
    res.status(201).json({
      message: "Consultation request submitted successfully",
      data: newConsultation,
    });
  }

  static async getConsultation(req: Request, res: Response) {
    const consultations = await Consultation.find({});
    res.status(200).json({
      message: "Consultation fetched successfully",
      data: consultations,
    });
  }
}
