import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/db";
import { runCurrencyOnceNow } from "../modules/CurrencyModule/CurrencyCron";

(async () => {
  try {
    await connectDB();

    await runCurrencyOnceNow();

    process.exit(0);
  } catch (err) {
    console.error("❌ Manual currency job failed:", err);
    process.exit(1);
  }
})();
