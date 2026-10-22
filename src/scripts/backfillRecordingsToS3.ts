// One-off move of existing Zoom class recordings to Amazon S3.
//
// Dry run by default: lists every Zoom recording since FROM, matches each one
// to its own class by start time, and prints what it would do. Nothing in
// Zoom is ever changed by this script.
//
//   npx ts-node --transpile-only src/scripts/backfillRecordingsToS3.ts
//
// Options (environment variables):
//   FROM=2026-02-01   earliest recording date to include
//   APPLY=1           record the match on each class and queue it for copying
//   COPY=1            with APPLY=1, copy the queued recordings to S3 now
//   LIMIT=5           with APPLY=1, only handle this many recordings (trial copy)
//   MEETING=<id>      only handle the class with this Meeting _id

import dotenv from "dotenv";
dotenv.config();

import dns from "dns";
import axios from "axios";
import mongoose from "mongoose";
import Meeting from "../modules/MeetingModule/MeetingModels/Meeting";
import "../modules/ServiceModule/models/Service";
import "../modules/TrainerModule/TrainerModel";
import "../modules/UserModule/models/User";
import { getZoomAccessToken } from "../utils/zoomAuth";
import { ZoomRecordingFile, encodeZoomMeetingUuid, pickBestMp4 } from "../utils/zoomRecordings";
import {
  copyMeetingRecordingToS3,
  findMeetingForRecording,
  queueRecordingForArchive,
  recordingArchiveConfig,
} from "../services/recordingArchive.service";

interface ZoomRecordingInstance {
  uuid: string;
  id: number;
  topic?: string;
  start_time: string;
  recording_files?: ZoomRecordingFile[];
}

const FROM = new Date(process.env.FROM || "2026-02-01");
const APPLY = process.env.APPLY === "1";
const COPY = process.env.COPY === "1";
const LIMIT = Number(process.env.LIMIT || 0) || Infinity;
const ONLY_MEETING = (process.env.MEETING || "").trim();

const zoomGet = async (path: string, params: Record<string, any> = {}) => {
  const token = await getZoomAccessToken();
  const { data } = await axios.get(`https://api.zoom.us/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    timeout: 30000,
  });
  return data;
};

const describeZoomError = (error: any) =>
  `${error?.response?.status || ""} ${error?.response?.data?.message || error?.message || error}`.trim();

const toDay = (date: Date) => date.toISOString().slice(0, 10);

// Preferred: list every recording for each class host, 30 days at a time.
// Needs the Zoom app permission cloud_recording:read:list_user_recordings:admin.
const listByHost = async (hostIds: string[]) => {
  const found: ZoomRecordingInstance[] = [];
  for (const hostId of hostIds) {
    for (let from = new Date(FROM); from < new Date(); from = new Date(from.getTime() + 30 * 86400000)) {
      const to = new Date(Math.min(from.getTime() + 29 * 86400000, Date.now()));
      let nextPageToken = "";
      do {
        const data = await zoomGet(`/users/${encodeURIComponent(hostId)}/recordings`, {
          from: toDay(from),
          to: toDay(to),
          page_size: 300,
          next_page_token: nextPageToken || undefined,
        });
        found.push(...(data?.meetings || []));
        nextPageToken = data?.next_page_token || "";
      } while (nextPageToken);
    }
  }
  return found;
};

// Fallback: for each meeting number, list its past class instances and fetch
// each instance's recording. Without the instance permission, only the newest
// recording per meeting number is visible.
const listByMeetingNumber = async (zoomMeetingIds: number[]) => {
  const found: ZoomRecordingInstance[] = [];
  let newestOnly = 0;
  for (const zoomId of zoomMeetingIds) {
    let uuids: string[] = [];
    try {
      const data = await zoomGet(`/past_meetings/${zoomId}/instances`);
      uuids = (data?.meetings || []).map((m: any) => String(m.uuid)).filter(Boolean);
    } catch {
      uuids = [];
    }

    if (uuids.length) {
      for (const uuid of uuids) {
        try {
          found.push(await zoomGet(`/meetings/${encodeZoomMeetingUuid(uuid)}/recordings`));
        } catch {
          // No recording for this instance.
        }
      }
    } else {
      try {
        found.push(await zoomGet(`/meetings/${zoomId}/recordings`));
        newestOnly += 1;
      } catch {
        // No recording for this meeting number.
      }
    }
  }
  return { found, newestOnly };
};

const main = async () => {
  const config = recordingArchiveConfig();
  console.log(`Mode: ${APPLY ? (COPY ? "APPLY + COPY" : "APPLY (queue only)") : "DRY RUN"}`);
  console.log(`Recordings from ${toDay(FROM)}; bucket: ${config.bucket || "(RECORDINGS_S3_BUCKET not set)"}`);
  if (APPLY && !config.bucket) throw new Error("Set RECORDINGS_S3_BUCKET before APPLY=1");

  try {
    await mongoose.connect(process.env.MONGO_URI!, { serverSelectionTimeoutMS: 10000 });
  } catch (error: any) {
    if (error?.syscall !== "querySrv") throw error;
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    await mongoose.connect(process.env.MONGO_URI!, { serverSelectionTimeoutMS: 10000 });
  }

  const meetingFilter: any = ONLY_MEETING
    ? { _id: new mongoose.Types.ObjectId(ONLY_MEETING) }
    : { localTime: { $gte: FROM, $lte: new Date() } };
  const zoomMeetingIds: number[] = (await Meeting.distinct("zoomMeetingId", meetingFilter))
    .map(Number)
    .filter(Number.isFinite);
  console.log(`Classes in the database use ${zoomMeetingIds.length} Zoom meeting numbers.`);

  // Find the Zoom users who host these meetings.
  const hostIds = new Set<string>();
  for (const zoomId of zoomMeetingIds) {
    try {
      const data = await zoomGet(`/meetings/${zoomId}`);
      if (data?.host_id) hostIds.add(String(data.host_id));
    } catch {
      // Meeting deleted in Zoom; its recordings may still be listed under the host.
    }
  }

  let instances: ZoomRecordingInstance[] = [];
  let listing = "host";
  try {
    if (!hostIds.size) throw new Error("no hosts found");
    instances = await listByHost([...hostIds]);
  } catch (error: any) {
    console.warn(`\n⚠️ Could not list recordings by host (${describeZoomError(error)}).`);
    console.warn("   The Zoom app probably lacks cloud_recording:read:list_user_recordings:admin.");
    console.warn("   Falling back to listing by meeting number.\n");
    const fallback = await listByMeetingNumber(zoomMeetingIds);
    instances = fallback.found;
    listing = "meeting-number";
    if (fallback.newestOnly) {
      console.warn(`   ${fallback.newestOnly} meeting numbers only showed their newest recording.\n`);
    }
  }

  const wanted = new Set(zoomMeetingIds);
  const seen = new Set<string>();
  instances = instances.filter((i) => {
    if (!i?.uuid || seen.has(i.uuid) || !wanted.has(Number(i.id))) return false;
    if (new Date(i.start_time) < FROM) return false;
    seen.add(i.uuid);
    return true;
  });
  instances.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const summary = {
    listing,
    recordings: instances.length,
    matched: 0,
    unmatched: 0,
    noMp4: 0,
    alreadyCopied: 0,
    wrongRecordingToday: 0,
    mp4Bytes: 0,
    allFilesBytes: 0,
    queued: 0,
    copied: 0,
    copyFailed: 0,
  };
  const claimedMeetings = new Set<string>();
  let handled = 0;

  for (const instance of instances) {
    const files = instance.recording_files || [];
    const allBytes = files.reduce((t, f) => t + Number(f.file_size || 0), 0);
    summary.allFilesBytes += allBytes;
    const mp4 = pickBestMp4(files);
    const label = `${instance.start_time} | zoom ${instance.id} | ${String(instance.topic || "").slice(0, 45)}`;

    if (!mp4) {
      summary.noMp4 += 1;
      console.log(`NO MP4     ${label}`);
      continue;
    }
    summary.mp4Bytes += Number(mp4.file_size || 0);

    const meeting: any = await findMeetingForRecording(instance.id, instance.start_time);
    if (!meeting || claimedMeetings.has(String(meeting._id))) {
      summary.unmatched += 1;
      console.log(`UNMATCHED  ${label}${meeting ? " (class already matched to another recording)" : ""}`);
      continue;
    }
    claimedMeetings.add(String(meeting._id));
    summary.matched += 1;

    if (meeting.recordingUrl && meeting.recordingUrl !== mp4.download_url) {
      summary.wrongRecordingToday += 1;
    }
    if (meeting.recordingArchive?.status === "copied") {
      summary.alreadyCopied += 1;
      console.log(`COPIED     ${label} -> class ${meeting._id}`);
      continue;
    }

    const sizeMb = (Number(mp4.file_size || 0) / 1048576).toFixed(0);
    if (!APPLY || handled >= LIMIT) {
      console.log(`MATCH      ${label} -> class ${meeting._id} (${sizeMb} MB)`);
      continue;
    }

    handled += 1;
    const queued = await queueRecordingForArchive(meeting._id, instance.uuid, mp4);
    if (!queued) {
      console.log(`SKIPPED    ${label} -> class ${meeting._id} (copy already in progress)`);
      continue;
    }
    summary.queued += 1;

    if (COPY) {
      const result = await copyMeetingRecordingToS3(meeting._id);
      if ("copied" in result) summary.copied += 1;
      if ("failed" in result) summary.copyFailed += 1;
      console.log(
        `${"copied" in result ? "COPIED NOW" : "COPY FAIL "} ${label} -> class ${meeting._id} (${sizeMb} MB)${
          "failed" in result ? ` ${result.error}` : ""
        }`,
      );
    } else {
      console.log(`QUEUED     ${label} -> class ${meeting._id} (${sizeMb} MB)`);
    }
  }

  const gb = (bytes: number) => `${(bytes / 1073741824).toFixed(2)} GB`;
  console.log("\nSummary");
  console.log({
    ...summary,
    mp4Bytes: gb(summary.mp4Bytes),
    allFilesBytes: gb(summary.allFilesBytes),
  });
  if (!APPLY) console.log("\nDry run only. Re-run with APPLY=1 (and LIMIT=5 COPY=1 for a trial copy).");
};

main()
  .catch((error) => {
    console.error("Backfill failed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
