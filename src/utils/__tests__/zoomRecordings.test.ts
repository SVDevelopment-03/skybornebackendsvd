import assert from 'node:assert/strict';
import {
  encodeZoomMeetingUuid,
  findClosestMeetingByStart,
  pickBestMp4,
} from '../zoomRecordings';

// Bi-weekly pair sharing one Zoom meeting number: each recording goes to its own class.
const may2 = { id: 'may-2', localTime: new Date('2026-05-02T04:30:00Z') };
const may16 = { id: 'may-16', localTime: new Date('2026-05-16T04:30:00Z') };
const pair = [may16, may2];
assert.equal(findClosestMeetingByStart(pair, '2026-05-02T04:32:10Z')?.id, 'may-2');
assert.equal(findClosestMeetingByStart(pair, '2026-05-16T04:29:00Z')?.id, 'may-16');
// Started late but same day: still matched.
assert.equal(findClosestMeetingByStart(pair, '2026-05-02T07:00:00Z')?.id, 'may-2');
// Nothing within the 6-hour window: no match rather than a wrong one.
assert.equal(findClosestMeetingByStart(pair, '2026-05-09T04:30:00Z'), null);
assert.equal(findClosestMeetingByStart(pair, undefined), null);
assert.equal(findClosestMeetingByStart(pair, 'not a date'), null);

// Best MP4: longest of 10+ minutes; audio and short clips are ignored.
const files = [
  { id: 'audio', file_type: 'M4A', download_url: 'a', file_size: 50, recording_start: '2026-05-02T04:30:00Z', recording_end: '2026-05-02T05:30:00Z' },
  { id: 'short', file_type: 'MP4', download_url: 's', file_size: 10, recording_start: '2026-05-02T04:30:00Z', recording_end: '2026-05-02T04:33:00Z' },
  { id: 'class', file_type: 'MP4', download_url: 'c', file_size: 120, recording_start: '2026-05-02T04:30:00Z', recording_end: '2026-05-02T05:25:00Z' },
  { id: 'no-url', file_type: 'MP4', file_size: 999, recording_start: '2026-05-02T04:30:00Z', recording_end: '2026-05-02T06:30:00Z' },
];
assert.equal(pickBestMp4(files)?.id, 'class');
assert.equal(pickBestMp4([files[1]])?.id, 'short');
assert.equal(pickBestMp4([files[0]]), null);
assert.equal(pickBestMp4([]), null);

// UUIDs with "/" at the start or "//" are double-encoded.
assert.equal(encodeZoomMeetingUuid('abcDEF123=='), 'abcDEF123%3D%3D');
assert.equal(encodeZoomMeetingUuid('/abc=='), encodeURIComponent(encodeURIComponent('/abc==')));
assert.equal(encodeZoomMeetingUuid('ab//c=='), encodeURIComponent(encodeURIComponent('ab//c==')));

console.log('zoomRecordings tests passed');
