// Copies class recordings from Zoom cloud storage to a private Amazon S3 bucket,
// serves them back for playback, and clears Zoom once a copy is verified.
//
// Everything here is off until switched on with environment variables:
//   RECORDINGS_S3_BUCKET            private bucket for recordings (required for all of it)
//   RECORDING_ARCHIVE_ENABLED=true  copy new recordings to S3 automatically
//   RECORDING_PLAYBACK_FROM_S3=true play copied recordings from S3 (otherwise Zoom, as before)
//   RECORDING_ZOOM_CLEANUP_ENABLED=true  move copied recordings to Zoom's trash
//   RECORDING_ZOOM_RETENTION_DAYS   days to keep a copied recording in Zoom (default 7)
// Any S3 failure during playback falls back to playing from Zoom.

import axios from "axios";
import { Transform, type Readable } from "stream";
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import Meeting, { IMeeting } from "../modules/MeetingModule/MeetingModels/Meeting";
import { getZoomAccessToken } from "../utils/zoomAuth";
import {
  ZoomRecordingFile,
  encodeZoomMeetingUuid,
  findClosestMeetingByStart,
  pickBestMp4,
} from "../utils/zoomRecordings";

const MAX_COPY_ATTEMPTS = 5;
const COPY_LOCK_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const LOG = "[RecordingArchive]";

export const recordingArchiveConfig = () => ({
  bucket: (process.env.RECORDINGS_S3_BUCKET || "").trim(),
  region: (process.env.RECORDINGS_S3_REGION || process.env.AWS_REGION || "").trim(),
  archiveEnabled: process.env.RECORDING_ARCHIVE_ENABLED === "true",
  playbackFromS3: process.env.RECORDING_PLAYBACK_FROM_S3 === "true",
  zoomCleanupEnabled: process.env.RECORDING_ZOOM_CLEANUP_ENABLED === "true",
  zoomRetentionDays: Math.max(1, Number(process.env.RECORDING_ZOOM_RETENTION_DAYS) || 7),
});

let s3Client: S3Client | null = null;
const getS3 = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: recordingArchiveConfig().region,
      credentials: {
        accessKeyId: (process.env.RECORDINGS_AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY)!,
        secretAccessKey: (process.env.RECORDINGS_AWS_SECRET_KEY || process.env.AWS_SECRET_KEY)!,
      },
    });
  }
  return s3Client;
};

const errorText = (error: any) =>
  String(
    error?.response?.data?.message ||
      error?.response?.data ||
      error?.message ||
      error,
  ).slice(0, 500);

const buildS3Key = (meeting: IMeeting, fileId: string, recordingStart?: Date) => {
  const start = recordingStart || new Date((meeting as any).localTime);
  const yyyy = start.getUTCFullYear();
  const mm = String(start.getUTCMonth() + 1).padStart(2, "0");
  return `recordings/${yyyy}/${mm}/${meeting._id}-${fileId}.mp4`;
};

// ======================================================
// FINDING A CLASS'S OWN RECORDING
// ======================================================

/**
 * Finds the Meeting document a Zoom recording belongs to: same Zoom meeting
 * number, class start closest to the recording start.
 */
export const findMeetingForRecording = async (
  zoomMeetingId: number | string,
  recordingStart: string | Date | undefined,
) => {
  const startMs = new Date(recordingStart || "").getTime();
  if (!Number.isFinite(startMs)) return null;
  const candidates = await Meeting.find({
    zoomMeetingId: Number(zoomMeetingId),
    localTime: {
      $gte: new Date(startMs - DAY_MS),
      $lte: new Date(startMs + DAY_MS),
    },
  })
    .select("_id title localTime recordingUrl recordingArchive")
    .lean();
  return findClosestMeetingByStart(candidates, recordingStart);
};

/**
 * Records which Zoom recording belongs to this class and queues it for copying.
 * Leaves an already copied or in-progress archive alone.
 */
export const queueRecordingForArchive = async (
  meetingId: any,
  zoomMeetingUuid: string,
  file: ZoomRecordingFile,
) => {
  if (!file?.id || !file.download_url) return null;
  return Meeting.findOneAndUpdate(
    {
      _id: meetingId,
      "recordingArchive.status": { $nin: ["copied", "copying"] },
    },
    {
      $set: {
        recordingArchive: {
          status: "pending",
          zoomMeetingUuid,
          zoomFileId: file.id,
          zoomFileSize: Number(file.file_size || 0),
          zoomDownloadUrl: file.download_url,
          recordingStart: file.recording_start ? new Date(file.recording_start) : undefined,
          attempts: 0,
          lockedUntil: null,
        },
      },
    },
    { new: true },
  );
};

/** Fetches the recording files for one specific class instance from Zoom. */
export const getZoomInstanceRecordings = async (zoomMeetingUuid: string) => {
  const token = await getZoomAccessToken();
  const { data } = await axios.get(
    `https://api.zoom.us/v2/meetings/${encodeZoomMeetingUuid(zoomMeetingUuid)}/recordings`,
    { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 },
  );
  return data;
};

// ======================================================
// COPY ZOOM -> S3
// ======================================================

/**
 * Copies one class's recording to S3 and verifies the stored size matches
 * Zoom's before marking it copied. Safe to call repeatedly: it claims the
 * record first, so two processes never copy the same class at once.
 */
export const copyMeetingRecordingToS3 = async (meetingId: any) => {
  const { bucket } = recordingArchiveConfig();
  if (!bucket) throw new Error("RECORDINGS_S3_BUCKET is not set");

  const now = new Date();
  const meeting = await Meeting.findOneAndUpdate(
    {
      _id: meetingId,
      "recordingArchive.status": { $in: ["pending", "failed"] },
      "recordingArchive.attempts": { $lt: MAX_COPY_ATTEMPTS },
      $or: [
        { "recordingArchive.lockedUntil": null },
        { "recordingArchive.lockedUntil": { $lt: now } },
      ],
    },
    {
      $set: {
        "recordingArchive.status": "copying",
        "recordingArchive.lockedUntil": new Date(now.getTime() + COPY_LOCK_MS),
      },
      $inc: { "recordingArchive.attempts": 1 },
    },
    { new: true },
  );
  if (!meeting?.recordingArchive) return { skipped: true as const };

  const archive = meeting.recordingArchive;
  let downloadStream: Readable | null = null;

  try {
    let downloadUrl = archive.zoomDownloadUrl || "";
    let expectedSize = Number(archive.zoomFileSize || 0);

    // Refresh the file details from Zoom; the stored ones may be stale.
    if (archive.zoomMeetingUuid) {
      try {
        const instance = await getZoomInstanceRecordings(archive.zoomMeetingUuid);
        const fresh = (instance?.recording_files || []).find(
          (f: ZoomRecordingFile) => f.id === archive.zoomFileId,
        );
        if (fresh?.download_url) {
          downloadUrl = fresh.download_url;
          expectedSize = Number(fresh.file_size || expectedSize);
          if (fresh.status && fresh.status !== "completed") {
            throw new Error(`Zoom file status is "${fresh.status}", not completed yet`);
          }
        }
      } catch (refreshError: any) {
        if (String(refreshError?.message || "").includes("not completed")) throw refreshError;
        console.warn(`${LOG} ${meeting._id}: could not refresh Zoom file details: ${errorText(refreshError)}`);
      }
    }
    if (!downloadUrl) throw new Error("No Zoom download URL stored for this recording");

    const token = await getZoomAccessToken();
    const response = await axios.get(downloadUrl, {
      params: { access_token: token },
      responseType: "stream",
      timeout: 60000,
      maxRedirects: 5,
    });
    downloadStream = response.data as Readable;

    const headerLength = Number(response.headers["content-length"] || 0);
    if (!expectedSize && headerLength) expectedSize = headerLength;
    if (!expectedSize) throw new Error("Zoom did not report the recording's size; cannot verify a copy");
    if (headerLength && headerLength !== expectedSize) {
      throw new Error(`Zoom reports ${expectedSize} bytes but is sending ${headerLength}`);
    }

    // Count bytes as they pass to S3, for the copy check below.
    let bytesRead = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytesRead += chunk.length;
        callback(null, chunk);
      },
    });
    downloadStream.on("error", (error) => counter.destroy(error));
    downloadStream.pipe(counter);

    const key = buildS3Key(meeting, String(archive.zoomFileId || "recording"), archive.recordingStart);
    await new Upload({
      client: getS3(),
      params: {
        Bucket: bucket,
        Key: key,
        Body: counter,
        ContentType: "video/mp4",
        Metadata: {
          "meeting-id": String(meeting._id),
          "zoom-meeting-uuid": String(archive.zoomMeetingUuid || ""),
          "zoom-file-id": String(archive.zoomFileId || ""),
        },
      },
      queueSize: 4,
      partSize: 16 * 1024 * 1024,
    }).done();

    // Verify: the stored object must be exactly the size Zoom reported.
    const head = await getS3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const storedSize = Number(head.ContentLength || 0);
    if (storedSize !== expectedSize || bytesRead !== expectedSize) {
      throw new Error(
        `Copy check failed: Zoom ${expectedSize} bytes, downloaded ${bytesRead}, S3 holds ${storedSize}`,
      );
    }

    await Meeting.updateOne(
      { _id: meeting._id },
      {
        $set: {
          "recordingArchive.status": "copied",
          "recordingArchive.s3Bucket": bucket,
          "recordingArchive.s3Key": key,
          "recordingArchive.s3Size": storedSize,
          "recordingArchive.zoomFileSize": expectedSize,
          "recordingArchive.copiedAt": new Date(),
          "recordingArchive.lockedUntil": null,
          "recordingArchive.lastError": "",
        },
      },
    );
    console.log(`${LOG} ${meeting._id}: copied ${storedSize} bytes to s3://${bucket}/${key}`);
    return { copied: true as const, key, size: storedSize };
  } catch (error: any) {
    downloadStream?.destroy();
    const message = errorText(error);
    await Meeting.updateOne(
      { _id: meeting._id },
      {
        $set: {
          "recordingArchive.status": "failed",
          "recordingArchive.lockedUntil": null,
          "recordingArchive.lastError": message,
        },
      },
    );
    console.error(`${LOG} ${meeting._id}: copy failed (attempt ${archive.attempts}): ${message}`);
    return { failed: true as const, error: message };
  }
};

/** Copies every queued recording, one at a time. */
export const runRecordingArchiveOnce = async (limit = 20) => {
  const pending = await Meeting.find({
    "recordingArchive.status": { $in: ["pending", "failed"] },
    "recordingArchive.attempts": { $lt: MAX_COPY_ATTEMPTS },
  })
    .select("_id")
    .sort({ localTime: 1 })
    .limit(limit)
    .lean();

  for (const item of pending) {
    await copyMeetingRecordingToS3(item._id);
  }
  return pending.length;
};

// ======================================================
// PLAYBACK FROM S3
// ======================================================

/**
 * Opens the S3 copy for playback, passing through the player's Range header.
 * Returns null when there is no verified copy, so the caller plays from Zoom.
 * Throws if S3 fails; the caller also falls back to Zoom then.
 */
export const openArchivedRecording = async (meeting: IMeeting, range?: string) => {
  const archive = meeting.recordingArchive;
  if (archive?.status !== "copied" || !archive.s3Key || !archive.s3Bucket) return null;

  const result = await getS3().send(
    new GetObjectCommand({
      Bucket: archive.s3Bucket,
      Key: archive.s3Key,
      Range: range || undefined,
    }),
  );
  return {
    body: result.Body as Readable,
    contentLength: result.ContentLength,
    contentRange: result.ContentRange,
    totalSize: Number(archive.s3Size || 0),
    partial: Boolean(range && result.ContentRange),
  };
};

// ======================================================
// CLEARING ZOOM
// ======================================================

/**
 * Moves recordings to Zoom's trash once their S3 copy has been verified for
 * RECORDING_ZOOM_RETENTION_DAYS. Zoom keeps trashed recordings for 30 days.
 * The S3 object is checked again right before each one is trashed.
 */
export const runZoomCleanupOnce = async (limit = 20) => {
  const { zoomRetentionDays } = recordingArchiveConfig();
  const cutoff = new Date(Date.now() - zoomRetentionDays * DAY_MS);

  const due = await Meeting.find({
    "recordingArchive.status": "copied",
    "recordingArchive.copiedAt": { $lte: cutoff },
    "recordingArchive.zoomTrashedAt": { $exists: false },
    "recordingArchive.zoomMeetingUuid": { $exists: true, $ne: "" },
  })
    .sort({ localTime: 1 })
    .limit(limit);

  const uuidsDone = new Set<string>();
  for (const meeting of due) {
    const archive = meeting.recordingArchive!;
    const uuid = String(archive.zoomMeetingUuid);
    try {
      const head = await getS3().send(
        new HeadObjectCommand({ Bucket: archive.s3Bucket!, Key: archive.s3Key! }),
      );
      if (Number(head.ContentLength || 0) !== Number(archive.s3Size || -1)) {
        throw new Error("S3 copy no longer matches the verified size; not clearing Zoom");
      }

      if (!uuidsDone.has(uuid)) {
        const token = await getZoomAccessToken();
        await axios.delete(
          `https://api.zoom.us/v2/meetings/${encodeZoomMeetingUuid(uuid)}/recordings`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { action: "trash" },
            timeout: 20000,
          },
        );
        uuidsDone.add(uuid);
      }

      await Meeting.updateOne(
        { _id: meeting._id },
        {
          $set: { "recordingArchive.zoomTrashedAt": new Date(), "recordingArchive.zoomTrashError": "" },
        },
      );
      console.log(`${LOG} ${meeting._id}: Zoom recording ${uuid} moved to Zoom trash`);
    } catch (error: any) {
      // 404 / 3301: Zoom has nothing left for this instance; treat as cleared.
      const zoomCode = error?.response?.data?.code;
      if (error?.response?.status === 404 && zoomCode === 3301) {
        await Meeting.updateOne(
          { _id: meeting._id },
          { $set: { "recordingArchive.zoomTrashedAt": new Date(), "recordingArchive.zoomTrashError": "not found in Zoom" } },
        );
        continue;
      }
      const message = errorText(error);
      await Meeting.updateOne(
        { _id: meeting._id },
        { $set: { "recordingArchive.zoomTrashError": message } },
      );
      console.error(`${LOG} ${meeting._id}: could not clear Zoom recording ${uuid}: ${message}`);
    }
  }
  return due.length;
};
