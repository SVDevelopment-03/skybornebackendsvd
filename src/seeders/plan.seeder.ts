import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db';
import PlanProduct from '../modules/PaymentModule/models/PlanProduct';

const DEFAULT_PLANS = [
  {
    planKey: 'gold-yoga',
    displayName: 'Gold Yoga',
    description: 'Gold Yoga plan with basic credits',
    price: 9.99,
    currency: 'USD',
    billingType: 'monthly',
    appleProductIds: ['com.skyborne.gold.monthly', 'com.skyborne.gold.yearly'],
    googleProductIds: [],
    stripePriceIds: [],
  },
  {
    planKey: 'diamond',
    displayName: 'Diamond',
    description: 'Diamond plan with additional credits',
    price: 19.99,
    currency: 'USD',
    billingType: 'monthly',
    appleProductIds: ['com.skyborne.diamond.monthly', 'com.skyborne.diamond.yearly'],
    googleProductIds: [],
    stripePriceIds: [],
  },
  {
    planKey: 'platinum',
    displayName: 'Platinum',
    description: 'Platinum plan with premium features',
    price: 29.99,
    currency: 'USD',
    billingType: 'monthly',
    appleProductIds: ['com.skyborne.platinum.monthly', 'com.skyborne.platinum.yearly'],
    googleProductIds: [],
    stripePriceIds: [],
  },
];

export const seedPlanProducts = async (): Promise<void> => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();

    for (const p of DEFAULT_PLANS) {
      await PlanProduct.updateOne({ planKey: p.planKey }, { $set: p }, { upsert: true });
      console.log(`✅ Upserted plan ${p.planKey}`);
    }

    console.log('🎉 Plan seeding complete');
  } catch (err) {
    console.error('❌ Seeder error:', err);
    throw err;
  }
};

// If run directly from CLI, execute the seeder and exit
if ((require as any).main === module) {
  seedPlanProducts()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

/*
Usage:
  - Target test or prod DB by setting `MONGO_URI` before running.

Examples:
  MONGO_URI="mongodb://localhost:27017/skyborne-test" npm run seed:plans
  MONGO_URI="mongodb+srv://.../skyborne" npm run seed:plans

The script uses the same DB connection logic as the server (see `src/config/db.ts`).
*/
/* Additional older seeder content removed — use exported `seedPlanProducts()` instead */
