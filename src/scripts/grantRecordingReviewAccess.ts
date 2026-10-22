// One-off: let a test reviewer watch every class recording that has a verified
// Amazon S3 copy, without paying and without using up any credits. Only the
// reviewer's own account and attendance records are touched. No code change.
//
// How it gets past the checks in GetMeetingRecording:
//   1. An active subscription with an end date in the future. No Stripe
//      subscription, invoice or charge is created; Stripe IDs are untouched.
//   2. At least 1 credit for each class type that has an S3 recording
//      (existing credits are only raised, never lowered).
//   3. A "replay" attendance with creditDeducted: true for each of those
//      classes, so watching one does not take a credit away. Each one it
//      creates is tagged reviewAccessGrant: true so the undo can find it.
//
// Dry run by default. Nothing is written unless APPLY=1.
//
//   npx ts-node --transpile-only src/scripts/grantRecordingReviewAccess.ts
//
// Options (environment variables):
//   EMAIL=someone@example.com   reviewer (default sonali.patil@svdigital.ae)
//   DAYS=30                     how long the free subscription lasts
//   APPLY=1                     write the changes (a backup is saved first)
//   REVERT=<backup file>        undo: restore the user from the backup and
//                               delete the tagged attendances (needs APPLY=1)

import dotenv from "dotenv";
dotenv.config();

import dns from "dns";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

const EMAIL = (process.env.EMAIL || "sonali.patil@svdigital.ae").trim().toLowerCase();
const DAYS = Number(process.env.DAYS || 30);
const APPLY = process.env.APPLY === "1";
const REVERT = process.env.REVERT;

// Same as normalizeLegacyMeetingServiceType in MeetingController.
const serviceTypeOf = (title?: string | null) => {
  const normalized = String(title || "").trim().toLowerCase();
  if (normalized === "zumba dance") return "yoga";
  if (normalized === "diet & nutrition") return "specialty";
  if (normalized === "yoga") return "yoga";
  if (normalized === "zumba") return "zumba";
  return "yoga";
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const main = async () => {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set in .env");
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db!;
  const users = db.collection("users");
  const meetings = db.collection("meetings");
  const services = db.collection("services");
  const attendances = db.collection("meetingattendances");

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}${REVERT ? " (UNDO)" : ""}`);

  const user = await users.findOne({ email: new RegExp(`^${escapeRegex(EMAIL)}$`, "i") });
  if (!user) throw new Error(`No user with email ${EMAIL}`);

  console.log("\nUser now:");
  console.log(JSON.stringify({
    _id: user._id,
    email: user.email,
    role: user.role,
    plan: user.plan,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    subscription: user.subscription,
    classCredits: user.classCredits,
    overAllclassCredits: user.overAllclassCredits,
    stripeSubscriptionId: user.stripeSubscriptionId || null,
  }, null, 2));

  // ---- Undo ----
  if (REVERT) {
    const backup = JSON.parse(fs.readFileSync(REVERT, "utf8"));
    if (String(backup.user._id) !== String(user._id)) throw new Error("Backup is for a different user");
    const tagged = await attendances.countDocuments({ user: user._id, reviewAccessGrant: true });
    console.log(`\nWill restore subscription and credits from ${REVERT}`);
    console.log(`Will delete ${tagged} tagged attendance record(s)`);
    console.log(`Will restore ${backup.markedAttendances.length} attendance record(s) it had marked`);
    if (!APPLY) {
      console.log("\nDry run only. Run again with APPLY=1 to undo.");
      await mongoose.disconnect();
      return;
    }
    const restore = (v: any) => (v === null ? undefined : v);
    const set: Record<string, any> = {};
    const unset: Record<string, any> = {};
    for (const key of ["subscription", "classCredits", "overAllclassCredits"]) {
      const v = restore(backup.user[key]);
      if (v === undefined) unset[key] = "";
      else set[key] = { ...v, ...(v.startDate ? { startDate: new Date(v.startDate) } : {}), ...(v.endDate ? { endDate: new Date(v.endDate) } : {}) };
    }
    await users.updateOne({ _id: user._id }, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    const del = await attendances.deleteMany({ user: user._id, reviewAccessGrant: true });
    for (const a of backup.markedAttendances) {
      await attendances.updateOne(
        { _id: new mongoose.Types.ObjectId(a._id) },
        { $set: { creditDeducted: a.creditDeducted ?? false } },
      );
    }
    const after = await users.findOne({ _id: user._id });
    console.log(`\nRestored. Deleted ${del.deletedCount} attendance record(s).`);
    console.log(JSON.stringify({
      subscription: after?.subscription,
      classCredits: after?.classCredits,
      overAllclassCredits: after?.overAllclassCredits,
    }, null, 2));
    await mongoose.disconnect();
    return;
  }

  if (user.role === "admin" || user.role === "trainer") {
    console.log(`\nUser is a ${user.role}; recordings are not credit-checked for her. Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  // ---- Classes with a verified S3 copy ----
  const archived = await meetings
    .find({ "recordingArchive.status": "copied" })
    .project({ title: 1, startTime: 1, service: 1, recordingArchive: 1 })
    .sort({ "recordingArchive.recordingStart": 1 })
    .toArray();
  const serviceDocs = await services
    .find({ _id: { $in: archived.map((m) => m.service).filter(Boolean) } })
    .project({ title: 1 })
    .toArray();
  const serviceTitle = new Map(serviceDocs.map((s) => [String(s._id), s.title]));

  console.log(`\nClasses with a verified S3 recording: ${archived.length}`);
  const neededTypes = new Set<string>();
  const toCreate: any[] = [];
  const toMark: any[] = [];
  const zumbaOnly: any[] = [];
  for (const m of archived) {
    const title = serviceTitle.get(String(m.service));
    const type = serviceTypeOf(title);
    const when = m.recordingArchive?.recordingStart || m.startTime;
    const label = `  ${m._id}  ${new Date(when).toISOString().slice(0, 10)}  ${String(title || "?").padEnd(16)}  ${m.title}`;

    // The backend moves any zumba credits into yoga before checking, so a
    // class filed under "Zumba" can't be watched by any member. Not fixable
    // from the account side; report it instead.
    if (type === "zumba") {
      zumbaOnly.push(m);
      console.log(`${label}  -> SKIPPED: "Zumba" service, members always get 403`);
      continue;
    }

    neededTypes.add(type);
    const existing = await attendances.findOne({ meeting: m._id, user: user._id });
    let action = "create replay attendance (no credit taken)";
    if (existing?.creditDeducted) action = "already has attendance, no credit will be taken";
    else if (existing) { action = "mark her existing attendance as credit already taken"; toMark.push(existing); }
    else toCreate.push(m);
    console.log(`${label}  -> ${action}`);
  }

  // ---- Subscription and credits ----
  const now = new Date();
  const sub = user.subscription || {};
  const subActive =
    String(sub.status || "").toLowerCase() === "active" &&
    !!sub.endDate && new Date(sub.endDate).getTime() > now.getTime();
  const newEnd = new Date(now.getTime() + DAYS * 24 * 60 * 60 * 1000);

  const set: Record<string, any> = {};
  if (!subActive) {
    set["subscription.status"] = "active";
    set["subscription.startDate"] = sub.startDate || now;
    set["subscription.endDate"] = newEnd;
  }
  for (const type of neededTypes) {
    if (Number(user.classCredits?.[type] || 0) < 1) set[`classCredits.${type}`] = 1;
    if (Number(user.overAllclassCredits?.[type] || 0) < 1) set[`overAllclassCredits.${type}`] = 1;
  }

  console.log("\nPlanned changes to her account:");
  console.log(Object.keys(set).length ? JSON.stringify(set, null, 2) : "  none");
  console.log(`Attendances to create: ${toCreate.length}, to mark: ${toMark.length}`);
  if (zumbaOnly.length) console.log(`Skipped "Zumba" classes: ${zumbaOnly.length}`);
  if (neededTypes.has("specialty") && !["diamond", "platinum"].includes(String(user.plan || "").toLowerCase())) {
    console.log(`Note: her plan "${user.plan || ""}" doesn't list Diet & Nutrition classes, so she may not see those in the app (the recording link itself works).`);
  }

  if (!APPLY) {
    console.log("\nDry run only. Run again with APPLY=1 to write.");
    await mongoose.disconnect();
    return;
  }

  // ---- Backup, then write ----
  const backupFile = path.resolve(
    `review-access-backup-${String(user._id)}-${now.toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(backupFile, JSON.stringify({
    user: {
      _id: user._id,
      email: user.email,
      subscription: user.subscription ?? null,
      classCredits: user.classCredits ?? null,
      overAllclassCredits: user.overAllclassCredits ?? null,
    },
    markedAttendances: toMark.map((a) => ({ _id: a._id, creditDeducted: a.creditDeducted ?? false })),
  }, null, 2));
  console.log(`\nBackup written: ${backupFile}`);

  if (Object.keys(set).length) {
    // Guard: only while she is still a plain member.
    const r = await users.updateOne(
      { _id: user._id, role: { $nin: ["admin", "trainer"] } },
      { $set: set },
    );
    console.log(`Account updated: matched ${r.matchedCount}, modified ${r.modifiedCount}`);
  }

  let created = 0;
  for (const m of toCreate) {
    // Re-check, so running twice never makes duplicates.
    if (await attendances.findOne({ meeting: m._id, user: user._id })) continue;
    await attendances.insertOne({
      meeting: m._id,
      user: user._id,
      status: "completed",
      joinedAt: now,
      completedAt: now,
      totalSessions: 1,
      sessions: [{ joinTime: now, leaveTime: now, duration: 0, mode: "replay" }],
      creditDeducted: true,
      reviewAccessGrant: true,
      createdAt: now,
      updatedAt: now,
    });
    created++;
  }
  for (const a of toMark) {
    await attendances.updateOne(
      { _id: a._id, creditDeducted: { $ne: true } },
      { $set: { creditDeducted: true } },
    );
  }
  console.log(`Attendances created: ${created}, marked: ${toMark.length}`);

  const after = await users.findOne({ _id: user._id });
  console.log("\nAccount after:");
  console.log(JSON.stringify({
    subscription: after?.subscription,
    classCredits: after?.classCredits,
    overAllclassCredits: after?.overAllclassCredits,
  }, null, 2));
  console.log(`\nTo undo later:\n  $env:APPLY="1"; $env:REVERT="${backupFile}"; npx ts-node --transpile-only src/scripts/grantRecordingReviewAccess.ts`);

  await mongoose.disconnect();
};

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
