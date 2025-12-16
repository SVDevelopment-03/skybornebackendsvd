// src/services/queues/emailQueue.ts
import Queue from "bull";

export interface WelcomeEmailJob {
  userId: string;
  email: string;
  firstName: string;
  plan: string;
  subscriptionStartDate: Date;
  subscriptionEndDate: Date;
}

// FULL DEBUG LOGGING FOR REDIS URL

export const emailQueue = new Queue<WelcomeEmailJob>(
  "welcome-emails",
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  {
    redis: {
      tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: null, // so we see full error stack
    },
  }
);

// =====================
// QUEUE EVENT DEBUGGING
// =====================

emailQueue.on("error", (err) => {
  console.error("❌ [QUEUE ERROR] Redis connection failed:", err);
});

emailQueue.on("waiting", (jobId) => {
  console.log("⏳ Job waiting in queue:", jobId);
});

emailQueue.on("active", (job) => {
  console.log("⚡ Job started:", job.id);
});

emailQueue.on("completed", (job, result) => {
  console.log("🎉 Job completed:", job.id, "Result:", result);
});

emailQueue.on("failed", (job, err) => {
  console.error("🔥 Job failed:", job.id, err);
});

// ==========================
// FUNCTION TO ADD NEW JOB
// ==========================

export const addWelcomeEmailJob = async (jobData: WelcomeEmailJob) => {
  console.log("➡️ addWelcomeEmailJob called");
  console.log("➡️ Redis URL being used:", process.env.REDIS_URL);
  console.log("➡️ Job Data:", jobData);

  try {
    const job = await emailQueue.add(jobData, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    console.log(`📬 Job successfully queued: ID = ${job.id}`);
    return job;
  } catch (error) {
    console.error("❌ Error adding job to queue:", error);
    throw error;
  }
};
