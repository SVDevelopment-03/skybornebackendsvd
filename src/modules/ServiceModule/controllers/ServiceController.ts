import { Request, Response } from "express";
import ServiceServices from "../services/ServiceServices";

const serviceService = new ServiceServices();

export default class ServiceController {
  static async getAllServices(req: Request, res: Response) {
    const services = await serviceService.getAllServices({});
    return res.status(200).json({
      success: true,
      message: "Services fetched successfully",
      data: services,
    });
  }
}
