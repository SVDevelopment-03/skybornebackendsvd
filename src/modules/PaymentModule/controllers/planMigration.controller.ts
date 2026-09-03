import { Request, Response } from 'express';
import PlanModel from '../../PlanModule/models/Plan';
import PlanProduct from '../models/PlanProduct';

export class PlanMigrationController {
  static async migrateLegacyPlans(req: Request, res: Response) {
    try {
      const legacyPlans = await PlanModel.find({}).lean();

      let created = 0;
      let updated = 0;

      for (const p of legacyPlans) {
        const planKey = p.uuid || (p.name || '').toLowerCase().replace(/\s+/g, '-');
        const payload = {
          planKey,
          displayName: p.name,
          description: p.description || '',
          price: p.price || 0,
          currency: 'USD',
          billingType: 'monthly',
          // preserve nothing for product ids — admin should add SKUs manually
        };

        const result = await PlanProduct.updateOne(
          { planKey },
          { $set: payload },
          { upsert: true },
        );

        if (result.upserted) created += 1;
        else updated += 1;
      }

      return res.status(200).json({ success: true, message: 'Migration complete', data: { total: legacyPlans.length, created, updated } });
    } catch (err: any) {
      console.error('❌ Migration failed:', err);
      return res.status(500).json({ success: false, message: err.message || 'Migration failed' });
    }
  }
}

export default PlanMigrationController;
