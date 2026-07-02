// src/services/email/initializeEmailServices.ts
import { startClassReminderCron } from "../cron/ClassReminderCron";
import { startSubscriptionExpiryReminderCron } from "../cron/SubscriptionExpiryReminderCron";

export const initializeEmailServices = () => {
  console.log("📧 Initializing email services...");
  try {
    console.log(
      "ℹ️ Starting class reminder and subscription expiry cron jobs in the current server process"
    );
    startClassReminderCron();
    startSubscriptionExpiryReminderCron();
    console.log("✅ All email services initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing email services:", error);
    throw error;
  }
};
