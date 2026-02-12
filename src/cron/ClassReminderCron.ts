// src/services/cron/ClassReminderCron.ts
import cron from "node-cron";
import Meeting from "../modules/MeetingModule/MeetingModels/Meeting";
import { ClassReminderService } from "../services/classReminderService";

/**
 * Cron Job: Check for upcoming classes and send reminders 10 minutes before
 * Runs every minute to check if any class is starting in the next 10-15 minutes
 */
export const startClassReminderCron = () => {
  console.log("🚀 Starting Class Reminder Cron Job...");

  // Run every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      console.log("⏰ Cron started:", new Date().toISOString());

      // Calculate time windows: 5-15 minutes from now
      const timeWindow = {
        start: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes from now
        end: new Date(now.getTime() + 15 * 60 * 1000), // 15 minutes from now
      };

      console.log("⏰ Time window for upcoming meetings:", timeWindow);

      // Find all meetings that start within this window AND haven't sent reminder yet
      const upcomingMeetings = await Meeting.find({
        localTime: {
          $gte: timeWindow.start,
          $lte: timeWindow.end,
        },
        reminderSent: false, // Add this field to track if reminder was sent
      }).select("_id title liveRegion liveTime localTime");

      console.log("⏰ Upcoming meetings found:", upcomingMeetings);

      if (upcomingMeetings.length > 0) {
        console.log(
          `⏰ Found ${upcomingMeetings.length} class(es) starting soon`
        );

        // Process each meeting
        for (const meeting of upcomingMeetings) {
          try {
            await ClassReminderService.sendClassReminder(
              (meeting._id as string).toString(),
              10 // 10 minutes before
            );

            // Mark reminder as sent
            await Meeting.updateOne(
              { _id: meeting._id },
              { reminderSent: true }
            );

            console.log(`✅ Reminder sent and marked for meeting ${meeting._id}`);
          } catch (error) {
            console.error(
              `❌ Error processing meeting ${meeting._id}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error("❌ Error in Class Reminder Cron Job:", error);
    }
  });

  console.log("✅ Class Reminder Cron Job Started (runs every minute)");
};


/**
 * Stop the cron job (if needed)
 */
export const stopClassReminderCron = () => {
  console.log("🛑 Stopping Class Reminder Cron Job");
  // Cron jobs from node-cron are automatically stopped on process exit
};