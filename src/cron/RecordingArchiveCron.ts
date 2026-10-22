import cron from "node-cron";
import {
  recordingArchiveConfig,
  runRecordingArchiveOnce,
  runZoomCleanupOnce,
} from "../services/recordingArchive.service";

let running = false;

const tick = async () => {
  if (running) return;
  running = true;
  try {
    const config = recordingArchiveConfig();
    if (config.archiveEnabled) {
      await runRecordingArchiveOnce();
    }
    if (config.zoomCleanupEnabled) {
      await runZoomCleanupOnce();
    }
  } catch (error: any) {
    console.error("[RecordingArchiveCron] run failed", error?.message || error);
  } finally {
    running = false;
  }
};

// Copies new class recordings to S3 and, when enabled, clears copied ones
// from Zoom. Every 10 minutes; does nothing unless switched on in .env.
export const startRecordingArchiveCron = () => {
  const config = recordingArchiveConfig();
  if (!config.bucket || (!config.archiveEnabled && !config.zoomCleanupEnabled)) {
    console.log("[RecordingArchiveCron] not started (recording archive is switched off)");
    return;
  }

  cron.schedule("*/10 * * * *", tick);
  console.log("[RecordingArchiveCron] started (every 10 minutes)", {
    bucket: config.bucket,
    copy: config.archiveEnabled,
    zoomCleanup: config.zoomCleanupEnabled,
    zoomRetentionDays: config.zoomRetentionDays,
  });
};
