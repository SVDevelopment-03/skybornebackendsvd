import { Request, Response } from 'express';
import PlanProduct from '../models/PlanProduct';

export class PlanProductController {
  static async getPlans(req: Request, res: Response) {
    try {
      const plans = await PlanProduct.find({}).lean();
      return res.status(200).json({ success: true, data: plans });
    } catch (err: any) {
      console.error('❌ Failed to fetch plans:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to fetch plans' });
    }
  }

  static async upsertPlan(req: Request, res: Response) {
    try {
      const payload = req.body;
      if (!payload || !payload.planKey) {
        return res.status(400).json({ success: false, message: 'planKey is required' });
      }

      const result = await PlanProduct.updateOne(
        { planKey: payload.planKey },
        { $set: payload },
        { upsert: true },
      );

      return res.status(200).json({ success: true, message: 'Plan upserted', data: payload });
    } catch (err: any) {
      console.error('❌ Failed to upsert plan:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to upsert plan' });
    }
  }

  static async updatePlanStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
      }

      const plan = await PlanProduct.findByIdAndUpdate(
        id,
        { isActive },
        { new: true },
      );

      if (!plan) {
        return res.status(404).json({ success: false, message: 'Plan not found' });
      }

      return res.status(200).json({ success: true, message: 'Plan status updated', data: plan });
    } catch (err: any) {
      console.error('❌ Failed to update plan status:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to update plan status' });
    }
  }

  static async deletePlan(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const plan = await PlanProduct.findByIdAndDelete(id);

      if (!plan) {
        return res.status(404).json({ success: false, message: 'Plan not found' });
      }

      return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
    } catch (err: any) {
      console.error('❌ Failed to delete plan:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to delete plan' });
    }
  }
}

export default PlanProductController;
