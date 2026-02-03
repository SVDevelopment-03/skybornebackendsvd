import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/db";
import { runCurrencyOnceNow } from "../modules/CurrencyModule/CurrencyCron";

(async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await connectDB();

    await runCurrencyOnceNow();

    console.log("🎉 Manual currency job completed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Manual currency job failed:", err);
    process.exit(1);
  }
})();
