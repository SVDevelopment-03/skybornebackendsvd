// ============================================================================
// Backend: trainerController.ts
// ============================================================================
import { Request, Response } from "express";
import CoachServices from "./TrainerServices";

const trainerService = new CoachServices();

export default class TrainerController {
  async getAll(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";

      const skip = (page - 1) * limit;

      const result = await trainerService.getAll({
        search,
        skip,
        limit,
      });

      return res.status(200).json({
        success: true,
        message: "Trainers fetched successfully",
        data: result.trainers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(result.total as number/ limit),
          total: result.total,
          limit,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const trainer = await trainerService.getById(id);
      return res.status(200).json({
        success: true,
        message: "Trainer fetched successfully",
        data: trainer,
      });
    } catch (error) {
      return res.status(404).json({ success: false, error });
    }
  }

  async create(req: Request, res: Response) {
    try {
      console.log("body", req.body);
      
      const trainer = await trainerService.create(req.body);
      return res.status(201).json({
        success: true,
        message: "Trainer created successfully",
        data: trainer,
      });
    } catch (error) {
      return res.status(400).json({ success: false, error });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const trainer = await trainerService.update(id, req.body);
      return res.status(200).json({
        success: true,
        message: "Trainer updated successfully",
        data: trainer,
      });
    } catch (error) {
      return res.status(400).json({ success: false, error });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await trainerService.delete(id);
      return res.status(200).json({
        success: true,
        message: "Trainer deleted successfully",
      });
    } catch (error) {
      return res.status(404).json({ success: false, error });
    }
  }
}