// Shared helpers for Zoom cloud recordings: choosing the playable MP4 and
// matching a recording to the class (Meeting document) it belongs to.

export interface ZoomRecordingFile {
  id?: string;
  file_type?: string;
  file_size?: number;
  download_url?: string;
  recording_start?: string;
  recording_end?: string;
  recording_type?: string;
  status?: string;
}

const MIN_CLASS_RECORDING_SECONDS = 10 * 60;

// Recordings more than this far from a class's start time are not matched to it.
export const RECORDING_MATCH_WINDOW_MS = 6 * 60 * 60 * 1000;

export const getRecordingFileDurationSeconds = (file: ZoomRecordingFile): number => {
  const startMs = new Date(file?.recording_start || "").getTime();
  const endMs = new Date(file?.recording_end || "").getTime();
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
    return Math.floor((endMs - startMs) / 1000);
  }
  return 0;
};

/**
 * Picks the MP4 to play: the longest one of at least 10 minutes, otherwise the
 * longest MP4 there is. Ties go to the larger, then the later, file.
 */
export const pickBestMp4 = (files: ZoomRecordingFile[] = []): ZoomRecordingFile | null => {
  const candidates = files
    .filter((f) => f?.file_type === "MP4" && f.download_url)
    .map((file) => ({
      file,
      durationSeconds: getRecordingFileDurationSeconds(file),
      fileSize: Number(file.file_size || 0),
    }));

  if (!candidates.length) return null;

  const byBestCandidate = (a: (typeof candidates)[number], b: (typeof candidates)[number]) =>
    b.durationSeconds - a.durationSeconds ||
    b.fileSize - a.fileSize ||
    new Date(b.file.recording_start || 0).getTime() -
      new Date(a.file.recording_start || 0).getTime();

  const longCandidates = candidates
    .filter((entry) => entry.durationSeconds >= MIN_CLASS_RECORDING_SECONDS)
    .sort(byBestCandidate);

  return (longCandidates[0] || candidates.sort(byBestCandidate)[0]).file;
};

/**
 * Bi-weekly classes share one Zoom meeting number, so the meeting number alone
 * does not say which class a recording belongs to. This picks the class whose
 * start time is closest to the recording's start, within RECORDING_MATCH_WINDOW_MS.
 */
export const findClosestMeetingByStart = <T extends { localTime?: Date | string | null }>(
  meetings: T[],
  recordingStart: Date | string | null | undefined,
  windowMs = RECORDING_MATCH_WINDOW_MS,
): T | null => {
  const startMs = new Date(recordingStart || "").getTime();
  if (!Number.isFinite(startMs)) return null;

  let best: T | null = null;
  let bestDiff = Infinity;
  for (const meeting of meetings) {
    const meetingMs = new Date(meeting?.localTime || "").getTime();
    if (!Number.isFinite(meetingMs)) continue;
    const diff = Math.abs(meetingMs - startMs);
    if (diff <= windowMs && diff < bestDiff) {
      best = meeting;
      bestDiff = diff;
    }
  }
  return best;
};

/**
 * Zoom requires a meeting UUID that starts with "/" or contains "//" to be
 * URL-encoded twice in API paths.
 */
export const encodeZoomMeetingUuid = (uuid: string): string => {
  const once = encodeURIComponent(uuid);
  return uuid.startsWith("/") || uuid.includes("//") ? encodeURIComponent(once) : once;
};
