import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import Meeting from "../modules/MeetingModule/MeetingModels/Meeting";
import MeetingAttendance from "../modules/MeetingModule/MeetingModels/MeetingAttendance";
import "../modules/UserModule/models/User";
import "../modules/TrainerModule/TrainerModel";
import "../modules/ServiceModule/models/Service";

dotenv.config();

// 🔴 HARD-CODED TRAINER 4 ID
const TRAINER_ID = new Types.ObjectId("694be0049c781ab5eba0293f");

const seedTrainer4Attendance = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/skyborne-production";

    await mongoose.connect(mongoUri);
    await Meeting.deleteMany({ trainer: TRAINER_ID });

    const meetings: any[] = [];
    const now = new Date();

    // 📅 Create meetings for last 7 days
    for (let i = 0; i < 7; i++) {
      const meetingDate = new Date(now);
      meetingDate.setDate(now.getDate() - i);
      meetingDate.setHours(10, 0, 0, 0);

      const meeting = await Meeting.create({
        zoomMeetingId: 900000 + i,
        title: `Trainer 4 Session Day ${i + 1}`,
        service: new Types.ObjectId(), // dummy
        regions: [
          {
            region: "India",
            localTime: "10:00 AM",
            timezone: "Asia/Kolkata",
            mode: "live",
          },
        ],
        liveRegion: "India",
        liveTime: "10:00 AM",
        startDate: meetingDate,
        localTime: meetingDate,
        trainer: TRAINER_ID,
        duration: 60,
        isLive: false,
        status: i % 3 === 0 ? "failed" : "completed",
        joinUrl: "https://zoom.us/j/123",
        startUrl: "https://zoom.us/s/123",
        createdBy: TRAINER_ID,
      });

      meetings.push(meeting);
    }

    // 👥 Attendance
    for (const meeting of meetings) {
      // 10 registered users
      for (let i = 0; i < 10; i++) {
        let status: "registered" | "joined" | "completed";

        if (i < 6) status = "completed";      // attended
        else if (i < 8) status = "joined";    // partially attended
        else status = "registered";           // no show

        await MeetingAttendance.create({
          meeting: meeting._id,
          user: new Types.ObjectId(), // dummy user
          status,
        });
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeder error", err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedTrainer4Attendance();
