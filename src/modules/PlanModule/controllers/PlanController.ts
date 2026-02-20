import { Request, Response } from "express";
import PlanServices from "../services/PlanService";
import { IPlan } from "../interfaces/plan.interface";
import ServiceModel from "../../ServiceModule/models/Service";

const planService = new PlanServices();

export default class PlanController {
  private static async getServiceTitleMap() {
    const services = await ServiceModel.find({}, { title: 1 }).lean();
    const serviceTitleMap = new Map<string, string>();

    services.forEach((service) => {
      const normalized = service.title.trim().toLowerCase();
      if (normalized) {
        serviceTitleMap.set(normalized, service.title.trim());
      }
    });

    return serviceTitleMap;
  }

  static async getAllPlans(req: Request, res: Response) {
    const plans = await planService.getPublicPlans();
    return res.status(200).json({
      success: true,
      message: "Plans fetched successfully",
      data: plans,
    });
  }

  static async getAdminPlans(req: Request, res: Response) {
    const search = (req.query.search as string) || "";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const data = await planService.getAdminPlans(search, page, limit);

    return res.status(200).json({
      success: true,
      message: "Plans fetched successfully",
      data,
    });
  }

  static async getPlanById(req: Request, res: Response) {
    const { planId } = req.params;
    const plan = await planService.getPlanById(planId);

    return res.status(200).json({
      success: true,
      message: "Plan fetched successfully",
      data: plan,
    });
  }

  static async createPlan(req: Request, res: Response) {
    const {
      name,
      services,
      price,
      classCountPerMonth,
      description = "",
      image = "/images/basic-plan.svg",
      features = [],
      order = 1,
      isActive = true,
    } = req.body as Partial<IPlan>;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Plan name is required",
      });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one service is required",
      });
    }
    const serviceTitleMap = await PlanController.getServiceTitleMap();
    if (serviceTitleMap.size === 0) {
      return res.status(400).json({
        success: false,
        message: "No services available. Please add services first.",
      });
    }
    const normalizedIncoming = Array.from(
      new Set(
        services.map((service) => String(service).trim().toLowerCase()),
      ),
    );
    const hasInvalidService = normalizedIncoming.some(
      (service) => !serviceTitleMap.has(service),
    );
    if (hasInvalidService) {
      return res.status(400).json({
        success: false,
        message: "Invalid service selected",
      });
    }
    const normalizedServices = normalizedIncoming
      .map((service) => serviceTitleMap.get(service))
      .filter((service): service is string => Boolean(service));

    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a number greater than or equal to 0",
      });
    }

    if (typeof classCountPerMonth !== "number" || classCountPerMonth < 0) {
      return res.status(400).json({
        success: false,
        message: "Class count/month must be a number greater than or equal to 0",
      });
    }

    const existingPlan = await planService.findByName(name.trim());
    if (existingPlan) {
      return res.status(409).json({
        success: false,
        message: "Plan name already exists",
      });
    }

    const plan = await planService.createPlan({
      name: name.trim(),
      services: normalizedServices,
      price,
      classCountPerMonth,
      description,
      image,
      features,
      order,
      isActive,
    });

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: plan,
    });
  }

  static async updatePlan(req: Request, res: Response) {
    const { planId } = req.params;
    const payload = req.body as Partial<IPlan>;

    if (payload.name && payload.name.trim()) {
      const duplicatePlan = await planService.findByName(
        payload.name.trim(),
        planId,
      );
      if (duplicatePlan) {
        return res.status(409).json({
          success: false,
          message: "Plan name already exists",
        });
      }
      payload.name = payload.name.trim();
    }

    if (payload.price !== undefined && (typeof payload.price !== "number" || payload.price < 0)) {
      return res.status(400).json({
        success: false,
        message: "Price must be a number greater than or equal to 0",
      });
    }

    if (
      payload.classCountPerMonth !== undefined &&
      (typeof payload.classCountPerMonth !== "number" ||
        payload.classCountPerMonth < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Class count/month must be a number greater than or equal to 0",
      });
    }

    if (payload.services !== undefined && (!Array.isArray(payload.services) || payload.services.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "At least one service is required",
      });
    }
    if (payload.services) {
      const serviceTitleMap = await PlanController.getServiceTitleMap();
      if (serviceTitleMap.size === 0) {
        return res.status(400).json({
          success: false,
          message: "No services available. Please add services first.",
        });
      }

      const normalizedIncoming = Array.from(
        new Set(
          payload.services.map((service) =>
            String(service).trim().toLowerCase(),
          ),
        ),
      );
      const hasInvalidService = normalizedIncoming.some(
        (service) => !serviceTitleMap.has(service),
      );
      if (hasInvalidService) {
        return res.status(400).json({
          success: false,
          message: "Invalid service selected",
        });
      }

      payload.services = normalizedIncoming
        .map((service) => serviceTitleMap.get(service))
        .filter((service): service is string => Boolean(service));
    }

    const updatedPlan = await planService.updatePlan(planId, payload);

    return res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      data: updatedPlan,
    });
  }

  static async updatePlanStatus(req: Request, res: Response) {
    const { planId } = req.params;
    const { isActive } = req.body as { isActive?: boolean };

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be boolean",
      });
    }

    const plan = await planService.updatePlan(planId, { isActive });

    return res.status(200).json({
      success: true,
      message: "Plan status updated successfully",
      data: plan,
    });
  }
}
